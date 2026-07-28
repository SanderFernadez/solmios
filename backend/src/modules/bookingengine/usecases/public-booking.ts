// bookingengine/usecases/public-booking.ts — Flujo unificado de reserva pública.
//
// Crea la reserva pending en `Reservations` (NO en `public_bookings`) + guest + (F0 0.16)
// dispara el createCheckoutSession de Stripe. El widget recibe `{reservationId, accessToken,
// checkoutUrl}` y redirige a la URL de Stripe (off-site).
//
// F2 2.5 — Materialización del hook de F0 0.16:
//   - `promoCode`: se valida vía `promo-codes/usecases/promo-validate.ts` (NO incrementa uses
//     ahí). Si es válido, aplica descuento sobre el subtotal. El incremento atómico de `uses`
//     ocurre DENTRO de `orm.transaction`, después de crear la reserva, re-leyendo el promo
//     para detectar una race concurrente. Si la tx falla, NO se incrementa (rollback).
//   - `upsells`: se validan ids contra `Upsells` (deben pertenecer al hotel + estar activos).
//     El total se calcula como Σ price × quantity (kind es solo un hint de UI para el
//     frontend; la matemática es price × qty para los tres kinds).
//   - `totalBreakdown`: { subtotal, promoDiscount, upsellsTotal, taxes, total } se devuelve
//     en la respuesta para que el widget muestre el detalle y Stripe cobre el `total`.
//
// Robustez F0 (pagos en prod, spec booking-unification §"PRECAUCIÓN CRÍTICA"):
//   Si `gw.createCharge` falla (hotel sin Stripe configurado, gateway caído, error de red,
//   secret inválido), la reserva SE CREA igual con status='pending' y se devuelve 201 con
//   `checkoutUrl: null` + `paymentError: <mensaje>`. El huésped al menos tiene su reserva; el
//   panel la muestra como "pendiente de pago". NO tirar 500: rompería la creación de reserva
//   por un problema de Stripe, que es una dependencia opcional por hotel.

import { safeParse } from '../../../shared/utils/safe-parse'
import type { RepositoryAdapter } from 'arckode-framework'
import { validate as validatePromoCode } from '../../promo-codes/usecases/promo-validate'

export interface UpsellItem {
  id: string
  quantity: number
}

/**
 * F2 2.5 — Deps opcionales para procesar `promoCode` y `upsells`. Si no se pasan, el usecase
 * funciona como antes (F0 0.16: persiste los campos sin validarlos). El controller los cablea
 * desde index.ts; los tests legacy que llaman con 2 args siguen funcionando (sin promo procesing).
 */
export interface PublicBookingExtraDeps {
  /** Repo de `promo_codes` para validar + incrementar uses. */
  promoCodes?: RepositoryAdapter<any>
  /** Repo de `upsells` para validar ids + computar upsellsTotal. */
  upsells?: RepositoryAdapter<any>
  /** Repo de `Configuration` para leer la tasa de impuesto del hotel (configuration('taxes')). */
  config?: RepositoryAdapter<any>
}

/**
 * F2 2.5 — Desglose del total que el widget muestra en el step Pay y que Stripe cobra.
 * Todos los importes en `hotels.currency` (multi-moneda es display only — el cobro es en base).
 */
export interface TotalBreakdown {
  /** room.basePrice × nights + upsellsTotal (antes de promo y antes de impuestos). */
  subtotal: number
  /** Descuento del promo (0 si no hay promo). Siempre >= 0. */
  promoDiscount: number
  /** Σ upsell.price × quantity. */
  upsellsTotal: number
  /** Σ impuestos (ITBIS + otros) sobre (subtotal - promoDiscount). */
  taxes: number
  /** (subtotal - promoDiscount) + taxes. Es lo que Stripe cobra. */
  total: number
}

/**
 * Error centinela para abortar la transacción cuando el promo se agotó concurrentemente
 * (alguien más lo usó entre la validación upfront y el commit). No se relanza — se atrapa
 * afuera de la tx y se devuelve 409 con `promoReason: 'max_uses_reached'`.
 */
class PromoUsesExhaustedError extends Error {
  constructor() { super('promo_uses_exhausted_concurrently'); this.name = 'PromoUsesExhaustedError' }
}

/**
 * Contrato mínimo del service que necesita el usecase. Es una interfaz (NO la clase concreta)
 * para que los tests puedan mockearlo sin instanciar el `BookingengineService` real.
 */
export interface PublicBookingStripeDeps {
  /**
   * Crea la Checkout Session sobre `Reservations`. Lanza si la reserva no existe o el hotel
   * no tiene pasarela. El usecase atrapa para degradar graceful (ver robustez F0).
   */
  createReservationCheckout(
    reservationId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ id: string; url: string; payment_status: string }>
}

export interface PublicBookingLogger {
  warn(msg: string, meta?: any): void
  error(msg: string, meta?: any): void
}

export async function getPublicBookingBySlug(orm: any, slug: string, query: any): Promise<any> {
  const hotels = await orm.findMany('Hotels', {}) as any[]
  const hotel = hotels.find((h: any) => h.name?.toLowerCase().replace(/\s+/g, '-') === slug || h.id === slug)
  if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }

  const rooms = await orm.findMany('Rooms', { hotelId: hotel.id }) as any[]
  let available = rooms.filter((r: any) => r.status === 'disponible' || r.status === 'available')

  if (query.checkIn && query.checkOut) {
    const hotelRes = await orm.findMany('Reservations', { hotelId: hotel.id }) as any[]
    const overlap = new Set(hotelRes
      .filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < query.checkOut && r.checkOut > query.checkIn)
      .map((r: any) => r.roomId))
    available = available.filter((r: any) => !overlap.has(r.id))
  }

  const roomIds = new Set(rooms.map((r: any) => r.id))
  const amsRaw = ((await orm.findMany('RoomAmenities', {})) as any[]).filter((a: any) => roomIds.has(a.roomId) && a.isActive !== false)
  const amsByRoom = new Map<string, string[]>()
  for (const a of amsRaw) {
    if (!amsByRoom.has(a.roomId)) amsByRoom.set(a.roomId, [])
    amsByRoom.get(a.roomId)!.push(a.amenityKey)
  }

  const byType = new Map<string, any[]>()
  for (const r of available) {
    const key = r.type || 'standard'
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push({ id: r.id, number: r.number, name: r.name, basePrice: r.basePrice, capacity: r.capacity })
  }
  const roomTypes = Array.from(byType.entries()).map(([type, items]) => ({
    type, count: items.length, price: items[0].basePrice, rooms: items,
    amenities: amsByRoom.get(items[0].id) || [],
  }))
  return { status: 200, body: { hotel: { id: hotel.id, name: hotel.name, slug: hotel.name?.toLowerCase().replace(/\s+/g, '-') }, roomTypes } }
}

/**
 * Crea la reserva pública y dispara el createCheckoutSession.
 *
 * @param orm            ORM del framework (mockeable en tests).
 * @param body           Body del POST `/api/public/booking`.
 * @param pushAvailability Callback opcional para invalidar cache de disponibilidad.
 * @param auth           Wrapper de auth (solo para assertOwnership del room).
 * @param stripe         (F0 0.16) Servicio que crea la Checkout Session. Si no se pasa, la
 *                       reserva se crea igual sin intentar cobro (compat con callers viejos
 *                       como `reservas/tests/ownership.test.ts` que no pasan este arg).
 * @param logger         (F0 0.16) Logger para avisar si Stripe falla (no rompe el flujo).
 * @param stripeUrls     (F0 0.16) URLs de success/cancel. Si no se pasan, no se intenta cobro.
 *                       El controller las arma desde el referer/host del request en F0 wiring.
 */
export async function createPublicBookingDirect(
  orm: any,
  body: any,
  pushAvailability?: (hotelId: string, roomId: string) => void,
  auth?: any,
  stripe?: PublicBookingStripeDeps,
  logger?: PublicBookingLogger,
  stripeUrls?: { successUrl: string; cancelUrl: string },
  // F2 2.5 — Deps para procesar promo + upsells. Opcional para no romper tests legacy
  // (que llaman con 2 args) ni callers viejos que todavía no cablean estos repos.
  extraDeps?: PublicBookingExtraDeps,
): Promise<any> {
  const {
    hotelId, roomId, guestName, guestEmail, guestPhone,
    checkIn, checkOut, adults, children: kids,
    // F2 2.5 — promoCode + upsells ahora se PROCESAN (F0 0.16 solo los persistía).
    promoCode,
    upsells,
  } = body

  if (!hotelId || !roomId || !guestName || !guestEmail || !checkIn || !checkOut) {
    return { status: 400, body: { error: 'Campos requeridos: hotelId, roomId, guestName, guestEmail, checkIn, checkOut' } }
  }
  if (checkIn >= checkOut) return { status: 400, body: { error: 'checkIn debe ser anterior a checkOut' } }

  const room = await orm.findById('Rooms', roomId) as any
  if (!room) return { status: 404, body: { error: 'Habitación no encontrada' } }
  // No hay usuario: el motor es público. La habitación tiene que ser del hotel del formulario.
  // Iba `assertOwnership(room, { hotelId })` — dos objetos, `===` siempre false: toda reserva daba 403.
  if (auth) auth.assertOwnership(room.hotelId, hotelId)

  const overlapping = (await orm.findMany('Reservations', { roomId })) as any[]
  const hasOverlap = overlapping.some((r: any) =>
    r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < checkOut && r.checkOut > checkIn)
  if (hasOverlap) return { status: 409, body: { error: 'Habitación no disponible en esas fechas' } }

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  const roomSubtotal = (room.basePrice || 0) * nights

  // ─── F2 2.5 — Upsells: validar ids contra el hotel y computar upsellsTotal ──────────
  // Defensa: si extraDeps.upsells no está cableado (compat F0 0.16 / callers viejos), no podemos
  // validar ids ni sumar precios, pero sí dejamos constancia en `notes` para el recepcionista
  // (HOOK F0 0.16 que se mantiene — los tests de checkout lo verifican). Cuando extraDeps SÍ está,
  // procesamos para valer: validamos ids, sumamos precios, y el summary lleva el total por línea.
  const upsellItems = Array.isArray(upsells) ? upsells.filter((u: any) => u && typeof u.id === 'string') : []
  let upsellsTotal = 0
  const upsellSummary: string[] = []
  if (upsellItems.length > 0 && extraDeps?.upsells) {
    const hotelUpsells = await extraDeps.upsells.findMany({ hotelId })
    const byId = new Map(hotelUpsells.map((u: any) => [u.id, u]))
    for (const item of upsellItems as UpsellItem[]) {
      const found = byId.get(item.id)
      // Solo se suman upsells activos del hotel. Si el cliente manda un id inexistente,
      // inactivo, o de otro hotel, se ignora (no fail-fast: el huésped no tiene la culpa
      // de un id stale en el frontend; mejor crear la reserva sin ese extra).
      if (!found || !found.active || found.hotelId !== hotelId) continue
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))
      const lineTotal = Number(found.price) * qty
      upsellsTotal += lineTotal
      upsellSummary.push(`${found.name}×${qty}=${lineTotal.toFixed(2)}`)
    }
  } else if (upsellItems.length > 0 && !extraDeps?.upsells) {
    // F0 0.16 — Sin repo de upsells, dejamos el resumen crudo (id×qty) para que el recepcionista
    // al menos vea qué pidió el huésped. No sumamos precios (no sabemos los values).
    logger?.warn('createPublicBookingDirect: upsells en el body sin extraDeps.upsells cableado — se persisten en notes sin precios', { hotelId })
    for (const item of upsellItems as UpsellItem[]) {
      upsellSummary.push(`${item.id}×${Math.max(1, Math.floor(Number(item.quantity) || 1))}`)
    }
  }

  // ─── F2 2.5 — Promo: validar upfront (read-only) ───────────────────────────────────
  // Si extraDeps.promoCodes no está, no procesamos (F0 0.16 behavior: persistimos el string
  // sin validarlo). Si está, validamos; si inválido, 400 con reason; si válido, descuento.
  let promoDiscount = 0
  let promoRecord: any = null
  let promoReason: string | undefined
  if (promoCode && extraDeps?.promoCodes) {
    const subtotal = roomSubtotal + upsellsTotal
    const result = await validatePromoCode(
      { promoCodes: extraDeps.promoCodes }, hotelId, String(promoCode), subtotal,
    )
    if (!result.valid) {
      return {
        status: 400,
        body: { error: 'promo_invalid', promoReason: result.reason ?? 'not_found' },
      }
    }
    promoDiscount = Number(result.discount) || 0
    // Re-lectura para tener id + uses + maxUses frescos (el increment atómico va en la tx).
    // result.code viene en upper-case (normalizado por validate).
    promoRecord = await extraDeps.promoCodes.findOne({ hotelId, code: result.code })
    // promoRecord podría ser null si el promo fue borrado entre validate y findOne (race
    // muy fina). Tratamos como "ya no aplica" — descuento 0 pero la reserva sigue.
    if (!promoRecord) {
      promoDiscount = 0
      promoReason = 'not_found'
    }
  }

  // ─── F2 2.5 — Cálculo del total con impuestos ──────────────────────────────────────
  // Orden: subtotal (room + upsells) - promoDiscount = base imponible; taxes sobre base;
  // total = base + taxes. Mismo fallback que folios/facturas: configuration('taxes') y si
  // está vacío, hotels.taxRate.
  const subtotalBeforeDiscount = roomSubtotal + upsellsTotal
  const taxableBase = Math.max(0, subtotalBeforeDiscount - promoDiscount)
  const taxRatePercent = extraDeps?.config ? await readTaxRate(extraDeps.config, hotelId, orm) : 0
  const taxes = round2((taxableBase * taxRatePercent) / 100)
  const totalAmount = round2(taxableBase + taxes)
  const totalBreakdown: TotalBreakdown = {
    subtotal: round2(subtotalBeforeDiscount),
    promoDiscount: round2(promoDiscount),
    upsellsTotal: round2(upsellsTotal),
    taxes,
    total: totalAmount,
  }

  // Notas enriquecidas con el detalle de promo/upsells para el recepcionista (F0 0.16 + F2 2.5).
  const notesParts: string[] = ['Reserva desde widget público']
  if (promoCode) notesParts.push(`Promo: ${promoCode}${promoReason ? ` (${promoReason})` : ''}`)
  if (upsellSummary.length > 0) notesParts.push(`Upsells: ${upsellSummary.join(', ')}`)
  notesParts.push(`Total: ${totalAmount.toFixed(2)} (subtotal ${subtotalBeforeDiscount.toFixed(2)}` +
    `${promoDiscount > 0 ? ` - promo ${promoDiscount.toFixed(2)}` : ''} + tax ${taxes.toFixed(2)})`)

  // ─── Transacción: guest + reservation + (promo uses++) ─────────────────────────────
  // Atomicidad (spec F2 2.5): si la creación de la reserva falla, NO se incrementa uses.
  // El incremento va AL FINAL de la tx, después de crear la reserva. Race concurrente
  // (dos widgets con el mismo promo maxUses=1): la re-lectura dentro de la tx detecta si
  // uses ya alcanzó maxUses y aborta con PromoUsesExhaustedError → 409 para el segundo.
  let reservation: any
  let guest: any
  try {
    await orm.transaction(async (tx: any) => {
      guest = await tx.create('Guests', {
        id: crypto.randomUUID(), hotelId, name: guestName, email: guestEmail, phone: guestPhone || '',
        documentType: 'passport', documentNumber: '', nationality: '', address: '',
      })
      // F0 0.13 — AccessToken público (UUID). Solo el flujo público lo setea; las reservas
      // creadas desde `/api/panel/reservas` NO lo reciben → `accessToken=null` → 404 en el
      // endpoint público (anti-enumeración IDOR, spec booking-unification D4).
      reservation = await tx.create('Reservations', {
        id: crypto.randomUUID(), hotelId, roomId, guestId: guest.id,
        checkIn, checkOut, status: 'pending', source: 'direct',
        adults: adults || 1, children: kids || 0, totalAmount, deposit: 0,
        notes: notesParts.join(' | '),
        accessToken: crypto.randomUUID(),
        // F2 2.5 — persistimos el promoCode validado (upper-case). Upsells van en `notes`
        // (no hay tabla puente reservation_upsells en este cambio).
        promoCode: promoCode ? String(promoCode).trim().toUpperCase() : undefined,
      })

      // F2 2.5 — Incremento atómico de promo.uses DENTRO de la tx. Re-lectura para detectar
      // races concurrentes. Si se agotó entre validate y commit, aborta (rollback de guest +
      // reservation, no se incrementa). El caller atrapa el centinela y devuelve 409.
      if (promoRecord) {
        const fresh = await tx.findOne?.('PromoCodes', { id: promoRecord.id }).catch(() => null) ?? promoRecord
        const freshUses = Number(fresh?.uses ?? promoRecord.uses ?? 0)
        const maxUses = fresh?.maxUses ?? promoRecord.maxUses
        if (typeof maxUses === 'number' && Number.isFinite(maxUses) && freshUses >= maxUses) {
          throw new PromoUsesExhaustedError()
        }
        await tx.update('PromoCodes', promoRecord.id, { uses: freshUses + 1 })
      }
    })
  } catch (e: any) {
    if (e instanceof PromoUsesExhaustedError) {
      logger?.warn(`Promo ${promoCode} agotado concurrentemente para hotel ${hotelId}`, { reservationId: reservation?.id })
      return { status: 409, body: { error: 'promo_invalid', promoReason: 'max_uses_reached' } }
    }
    // Otros errores de la tx: relanzar como antes (el controller pasa a 500 si no se atrapa).
    throw e
  }

  pushAvailability?.(hotelId, roomId)

  // F0 0.16 — Cableo del checkoutUrl. ROBUSTEZ: si Stripe falla (no configurado, gateway
  // caído), la reserva SE CREÓ igual. Devolvemos 201 con checkoutUrl:null + paymentError.
  // El huésped al menos tiene su reserva; el panel la ve como "pending".
  let checkoutUrl: string | null = null
  let paymentError: string | null = null
  if (stripe && stripeUrls) {
    try {
      const session = await stripe.createReservationCheckout(
        reservation.id, totalAmount, stripeUrls.successUrl, stripeUrls.cancelUrl,
      )
      checkoutUrl = session.url || null
    } catch (e: any) {
      // NO relanzar — robustez F0. La reserva ya está creada; lo peor que podemos hacer es
      // tirar 500 y que el huésped crea que la reserva no se hizo (cuando sí se hizo).
      paymentError = e?.message || 'payment_gateway_unavailable'
      logger?.warn(
        `Reserva ${reservation.id} creada pero Stripe falló — checkoutUrl null, paymentError="${paymentError}"`,
        { hotelId, reservationId: reservation.id },
      )
    }
  }

  return {
    status: 201,
    body: {
      reservation, guest,
      // F0 0.16 — Contrato nuevo (spec booking-unification API). `checkoutUrl` SIEMPRE está:
      // null cuando no se intentó cobro (sin stripe deps / sin URLs) o cuando Stripe falló.
      // `paymentError` solo se incluye si realmente hubo un error de pasarela (para que el
      // frontend pueda mostrarlo al huésped o logearlo).
      checkoutUrl,
      // F2 2.5 — Desglose del total para que el widget muestre el detalle y Stripe cobre el
      // total correcto. Siempre se devuelve (aunque no haya promo/upsells, los importes van
      // en 0) para que el frontend tenga un contrato estable.
      totalBreakdown,
      ...(paymentError !== null ? { paymentError } : {}),
    },
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * Tasa de impuesto (%) del hotel. Copia del fallback estándar del proyecto (folios/facturas/
 * reservas/checkin): lee `configuration(key='taxes')` y si está vacío cae a `hotels.taxRate`.
 *
 * `orm` se pasa solo para el fallback a hotels.taxRate (via orm.findById, ya que el usecase
 * no recibe hotelsRepo por separado — mantener la firma compacta). Si extraDeps.config no está
 * cableado, devuelve 0 (compat con callers que no cablean config).
 */
async function readTaxRate(config: RepositoryAdapter<any>, hotelId: string, orm: any): Promise<number> {
  try {
    let c = await config.findOne({ hotelId, key: 'taxes' })
    if (!c) c = await config.findOne({ hotelId, key: 'impuestos' })
    const arr: any[] = c?.value ?? []
    const configured = arr
      .filter((t) => t && (t.activo ?? t.active))
      .reduce((s, t) => s + Number(t.tasa ?? t.rate ?? 0), 0)
    if (configured > 0) return configured
  } catch { /* cae al fallback */ }
  try {
    const hotel = await orm.findById('Hotels', hotelId)
    return Number((hotel as any)?.taxRate) || 0
  } catch {
    return 0
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
