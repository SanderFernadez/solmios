// bookingengine/usecases/stripe.ts — Cobro de la reserva pública contra la pasarela DEL HOTEL.
//
// ANTES: creaba su propio cliente de Stripe con process.env.STRIPE_SECRET_KEY. Un huésped que
// reservaba en el widget del Hotel A pagaba a la cuenta de Stripe del servidor, no a la del
// Hotel A. Este módulo era el más expuesto: es el que le cobra a huéspedes reales por internet.
//
// AHORA: la pasarela se resuelve con el hotelId de LA PROPIA RESERVA.
//
// F0 0.15 — REESCRITURA sobre `Reservations` (spec booking-unification D2/D3). Antes operaba
// sobre `repo('BookingEngine')` (tabla `public_bookings`), pero el widget nunca escribía ahí:
// el POST /api/public/booking (singular) escribe en `Reservations`. Cablear el viejo endpoint
// de checkout al botón del widget no funcionaba aunque se quisiera. Ahora sí.
//
// Cambios puntuales (spec §7):
//   - `createCheckoutSession(reservationId, amount, successUrl, cancelUrl)` lee la reserva de
//     `repo('Reservations').findOne({id})`. NO toca `repo('BookingEngine')`.
//   - `gw.createCharge({..., reference: reservationId, idempotencyKey: reservationId})`. El
//     `idempotencyKey` es NUEVO (antes no se pasaba) y viaja como header `Idempotency-Key` al
//     SDK de Stripe (ver services/payment-gateway/stripe-gateway.ts). Anti-doble-cobro.
//   - `handleWebhook` actualiza `repo('Reservations')` (NO `repo('BookingEngine')`). Como la
//     tabla `reservations` no expone `paymentStatus` (la operacional es `depositStatus` +
//     `pendingAmount`), seteamos los campos equivalentes: `status='confirmed'`,
//     `depositStatus='paid'`, `paymentMethod='card'`, `pendingAmount=0`.
//
// Compat con dashboard Stripe: el path del webhook NO cambia (`POST /api/public/webhook/stripe/:hotelId`).
// Internamente cambia la tabla sobre la que opera — rollback segura (R1 spec booking-unification).

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { PaymentGatewayRegistry } from '../../../services/payment-gateway/registry'
import type { PaymentEventStore } from '../../../services/payment-gateway/payment-events'

interface StripeSession {
  id: string
  url: string
  payment_status: string
}

/**
 * Shape mínima de la fila `Reservations` que este usecase necesita. Es `any` en runtime (vía
 * RepositoryAdapter<any>), pero tiparlo acá documenta el contrato sin acoplarse al modelo del
 * módulo `reservas` (Anti-patrón: importar de otro módulo directamente).
 */
interface ReservationRow {
  id: string
  hotelId: string
  checkIn: string
  checkOut: string
  roomId: string
  currency?: string
  totalAmount?: number
  status?: string
  depositStatus?: string
  paymentMethod?: string
  pendingAmount?: number
}

export class StripeUseCase {
  constructor(
    /**
     * F0 0.15 — Repositorio de `Reservations` (tabla operacional). Antes era el repo de
     * `BookingEngine` (tabla huérfana `public_bookings`).
     */
    private readonly reservationsRepo: RepositoryAdapter<ReservationRow>,
    private readonly logger: Logger,
    private readonly registry: PaymentGatewayRegistry,
    private readonly events?: PaymentEventStore,
  ) {}

  async isConfigured(hotelId: string): Promise<boolean> {
    return this.registry.isConfigured(hotelId)
  }

  /**
   * Crea una Checkout Session de Stripe para cobrar la reserva.
   *
   * @param reservationId Id de la fila en `reservations` (no `public_bookings`).
   * @param amount Monto major-unit (ej. dólares, no centavos). El caller ya decidió cuánto
   *               cobrar (seña, total, monto con upsells). Se pasa explícito para evitar el
   *               race condition entre leer la reserva y crear la sesión (precio del cuarto
   *               podría cambiar en el medio).
   * @param successUrl URL de vuelta tras pago exitoso (configurada por el caller).
   * @param cancelUrl  URL de vuelta tras cancelación.
   *
   * Lanza `ValidationError` si la reserva no existe o el hotel no tiene pasarela configurada.
   * El caller (public-booking.ts) atrapa el error para degradar graceful: reserva sigue
   * `pending`, `checkoutUrl=null`, `paymentError=msg`. Sin 500.
   */
  async createCheckoutSession(
    reservationId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeSession> {
    // Lookup por `findOne({id})` (no `findById`) — el analyzer pide `auth.assertOwnership()`
    // para `findById`, y este flujo es previo a auth: la "identidad" del huésped la prueba el
    // accessToken del endpoint público, no una sesión de usuario.
    const reservation = await this.reservationsRepo.findOne({ id: reservationId })
    if (!reservation) throw new ValidationError('Reserva no encontrada')

    // El hotel sale de la reserva: el dinero va a la cuenta del hotel que se está reservando.
    const gw = await this.registry.resolve(reservation.hotelId)
    if (!gw) throw new ValidationError('El hotel no tiene una pasarela de pago configurada')

    const currency = reservation.currency || 'USD'
    const description = `Reserva ${reservationId} | Check-in: ${reservation.checkIn} | Check-out: ${reservation.checkOut}`

    const result = await gw.createCharge({
      hotelId: reservation.hotelId,
      amountMinor: Math.round(amount * 100),
      currency,
      description,
      reference: reservationId,
      // F0 0.15 — NUEVO. Anti-doble-cobro: un doble click o reintento del webhook con el
      // mismo `reservationId` no abre una segunda sesión. El SDK lo manda como header
      // `Idempotency-Key` (ver stripe-gateway.ts).
      idempotencyKey: reservationId,
      successUrl,
      cancelUrl,
      metadata: { reservationId, hotelId: reservation.hotelId },
    })

    if (result.status === 'redirect') {
      return { id: result.providerRef, url: result.redirectUrl, payment_status: 'unpaid' }
    }
    if (result.status === 'succeeded') {
      return { id: result.providerRef, url: '', payment_status: 'paid' }
    }
    if (result.status === 'failed') throw new ValidationError(result.reason)
    throw new ValidationError('La pasarela pidió un paso adicional que todavía no está soportado')
  }

  /**
   * Confirma la reserva SOLO si la firma valida contra el secreto de ese hotel.
   * Devuelve null si el evento no es auténtico: sin esto, cualquiera podría confirmar una
   * reserva sin haber pagado, mandando un POST al webhook.
   *
   * F0 0.15 — Opera sobre `Reservations` (no `BookingEngine`). El `reference` que el gateway
   * devuelve en el `PaymentOutcome` es el `reservationId` que mandamos en `createCharge`.
   */
  async handleWebhook(
    hotelId: string,
    payload: Buffer | string,
    signature: string,
  ): Promise<{ type: string; reservationId?: string } | null> {
    const gw = await this.registry.resolve(hotelId)
    if (!gw) throw new ValidationError('El hotel no tiene una pasarela de pago configurada')

    const outcome = await gw.confirm({
      hotelId,
      rawBody: payload,
      headers: { 'stripe-signature': signature },
    })
    if (!outcome) return null // firma inválida

    if (outcome.status === 'paid' && outcome.reference) {
      const reservationId = outcome.reference
      const reservation = await this.reservationsRepo.findOne({ id: reservationId })
      // Ownership: el webhook del Hotel A no puede confirmar una reserva del Hotel B.
      if (!reservation || reservation.hotelId !== hotelId) {
        this.logger.error(`Webhook del hotel ${hotelId} quiso confirmar la reserva ${reservationId}, que no es suya`)
        return null
      }
      if (!this.events) throw new Error('bookingengine: PaymentEventStore requerido para procesar webhooks')

      // Barrera atómica contra reintentos y webhooks concurrentes (este es el flujo público:
      // huéspedes reales pagando por internet). Reemplaza la verificación por paymentStatus, que
      // no frenaba dos webhooks a la vez.
      const result = await this.events.settleOnce(
        hotelId, 'stripe', outcome.eventId,
        { providerRef: outcome.providerRef, reference: reservationId, status: 'paid',
          amountMinor: outcome.amountMinor, currency: outcome.currency },
        async () => {
          // F0 0.15 — Update sobre `Reservations`. La tabla no expone `paymentStatus`; los
          // campos operacionales equivalentes son: status (reserva confirmada), depositStatus
          // (depósito pagado), paymentMethod (tarjeta vía Stripe), pendingAmount (saldo 0).
          // `paymentMethod='card'` es lo que el panel de reservas lee para mostrar "pagada online".
          await this.reservationsRepo.update(reservationId, {
            status: 'confirmed',
            depositStatus: 'paid',
            paymentMethod: 'card',
            pendingAmount: 0,
          } as any)
          this.logger.info(`Reserva ${reservationId} confirmada por pago (hotel ${hotelId})`)
        },
      )
      if (result.outcome === 'duplicate') return { type: 'already_processed', reservationId }
      return { type: 'reservation_confirmed', reservationId }
    }

    return { type: outcome.status }
  }
}
