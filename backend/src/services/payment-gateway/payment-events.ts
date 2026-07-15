// services/payment-gateway/payment-events.ts — Idempotencia atómica de cobros.
//
// El mismo cobro llega más de una vez: Stripe reintenta el webhook, CardNet reintenta hasta
// recibir 200, el huésped recarga la página de retorno de Azul. La idempotencia "por estado de
// entidad" (pr.status === 'paid') que ya existe funciona en el caso feliz, pero NO frena dos
// webhooks concurrentes: ambos leen 'pending' antes de que ninguno escriba 'paid', y el cobro
// se asienta dos veces (el mismo bug de doble conteo que ya vivimos con invoices.type).
//
// Barrera real: el id de la fila es `${provider}:${eventId}`. Como es la PRIMARY KEY, insertar
// el mismo evento dos veces falla a nivel base — atómico, sin importar cuántos webhooks corran a
// la vez. No hace falta un índice único compuesto (que el ORM no crea).

import type { RepositoryAdapter, Logger } from 'arckode-framework'

export interface PaymentEventRow {
  id: string
  hotelId: string
  provider: string
  eventId: string
  providerRef?: string
  reference?: string
  status?: string
  amountMinor?: number
  currency?: string
  processedAt?: string
}

/** Detecta la violación de PK/unique en SQLite y Postgres (el mensaje difiere por motor). */
function isDuplicateError(e: unknown): boolean {
  const msg = String((e as any)?.message ?? e).toLowerCase()
  return (
    msg.includes('unique constraint') ||   // SQLite: "UNIQUE constraint failed"
    msg.includes('duplicate key') ||        // Postgres: "duplicate key value violates unique constraint"
    msg.includes('constraint failed')
  )
}

export interface SettleMeta {
  providerRef?: string
  reference?: string
  status?: string
  amountMinor?: number
  currency?: string
}

export type SettleResult =
  | { outcome: 'processed' }   // era nuevo y el efecto corrió
  | { outcome: 'duplicate' }   // ya se había procesado: no se tocó nada

export class PaymentEventStore {
  constructor(
    private readonly repo: RepositoryAdapter<PaymentEventRow>,
    private readonly logger: Logger,
    private readonly nowIso: () => string = () => new Date().toISOString(),
  ) {}

  private idFor(provider: string, eventId: string): string {
    return `${provider}:${eventId}`
  }

  /**
   * Corre `effect` UNA sola vez para este evento, aunque el webhook llegue repetido o concurrente.
   *
   * Orden (claim-first): se reserva el evento ANTES de asentar el dinero. El que gana el insert
   * corre el efecto; cualquier otro webhook con el mismo eventId ve el duplicado y sale sin tocar
   * nada. Si el efecto FALLA, se libera la reserva para que el reintento del proveedor lo reprocese
   * — mejor reprocesar que perder un cobro.
   *
   * Ventana conocida: si el proceso se cae entre reservar y terminar el efecto, la reserva queda
   * huérfana y ese evento no se reprocesa. Es una ventana de milisegundos frente a un crash; se
   * acepta a cambio de la garantía anti-doble-cobro, que es el riesgo con plata de por medio.
   */
  async settleOnce(
    hotelId: string,
    provider: string,
    eventId: string,
    meta: SettleMeta,
    effect: () => Promise<void>,
  ): Promise<SettleResult> {
    if (!eventId) {
      // Sin id de evento no hay idempotencia posible: corremos el efecto pero avisamos.
      this.logger.warn(`Evento ${provider} sin eventId: se procesa sin barrera de idempotencia`)
      await effect()
      return { outcome: 'processed' }
    }

    const claimed = await this.claim(hotelId, provider, eventId, meta)
    if (!claimed) return { outcome: 'duplicate' }

    try {
      await effect()
      return { outcome: 'processed' }
    } catch (e) {
      // El efecto falló: soltar la reserva para no bloquear el reintento del proveedor.
      await this.release(provider, eventId)
      throw e
    }
  }

  /** Reserva el evento. true = nuevo (seguí), false = ya existía (reintento). */
  private async claim(hotelId: string, provider: string, eventId: string, meta: SettleMeta): Promise<boolean> {
    try {
      await this.repo.create({
        id: this.idFor(provider, eventId),
        hotelId, provider, eventId,
        providerRef: meta.providerRef, reference: meta.reference,
        status: meta.status, amountMinor: meta.amountMinor, currency: meta.currency,
        processedAt: this.nowIso(),
      } as Omit<PaymentEventRow, 'id'> & { id: string })
      return true
    } catch (e) {
      if (isDuplicateError(e)) return false
      throw e // un error real de base no debe silenciarse como "duplicado"
    }
  }

  private async release(provider: string, eventId: string): Promise<void> {
    try {
      await this.repo.delete(this.idFor(provider, eventId))
    } catch (e) {
      this.logger.error(`No se pudo liberar el evento ${provider}:${eventId}: ${(e as any)?.message}`)
    }
  }
}
