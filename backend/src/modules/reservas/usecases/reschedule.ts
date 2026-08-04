// reservas/usecases/reschedule.ts
// Mover (cambiar habitación/fechas) o extender (cambiar salida) una reserva desde el planning.
// - quoteReschedule: dry-run, NO escribe. Devuelve disponibilidad + diferencia de precio para el modal.
// - commitReschedule: aplica el cambio (reusa updateReservation → revalida solape) y cobra la diferencia.
// El cobro NO se orquesta acá: se delega a un puerto inyectado por el connector (folio/efectivo/tarjeta).

import { NotFoundError, AuthError, ConflictError } from 'arckode-framework'
import { assertRoomAvailable } from './availability'
import { updateReservation } from './crud'

const MS_PER_DAY = 86_400_000
const round2 = (n: number) => Math.round(n * 100) / 100
const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY))

export type RescheduleChargeMethod = 'folio' | 'cash' | 'card'

export interface RescheduleChargeParams {
  reservationId: string
  hotelId: string
  guestId: string | null
  roomId: string | null
  currency: string
  amount: number
  method: RescheduleChargeMethod
  reason?: string
  successUrl?: string
  cancelUrl?: string
}

export interface RescheduleChargeResult {
  method: RescheduleChargeMethod
  applied: boolean
  target: string
  folioId?: string
  chargeId?: string
  paymentId?: string
  checkoutUrl?: string
  message?: string
}

export type RescheduleChargePort = (params: RescheduleChargeParams, user: any) => Promise<RescheduleChargeResult>

export interface RescheduleInput {
  roomId?: string
  checkIn?: string
  checkOut?: string
  charge?: { method: RescheduleChargeMethod; amount?: number; reason?: string }
  successUrl?: string
  cancelUrl?: string
}

export interface RescheduleQuote {
  reservationId: string
  roomId: string
  checkIn: string
  checkOut: string
  basePrice: number
  oldNights: number
  newNights: number
  previousTotal: number
  quotedNewPrice: number
  difference: number
  roomChanged: boolean
  datesChanged: boolean
  currency: string
}

export interface RescheduleDeps {
  repo: any
  roomRepo: any
  logger?: any
  cache?: any
  sockets?: any
  chargePort?: RescheduleChargePort
  audit?: (entry: Record<string, unknown>) => void
}

function assertOwnership(existing: any, user: { role: string; hotelId?: string }): void {
  if (!existing) throw new NotFoundError('Reserva no encontrada')
  if (user.role !== 'super_admin' && existing.hotelId !== user.hotelId) throw new AuthError('No autorizado')
}

async function buildQuote(roomRepo: any, existing: any, input: RescheduleInput): Promise<RescheduleQuote> {
  const roomId = input.roomId || existing.roomId
  const checkIn = input.checkIn || existing.checkIn
  const checkOut = input.checkOut || existing.checkOut
  if (checkIn >= checkOut) throw new ConflictError('checkIn debe ser anterior a checkOut')
  const room = await roomRepo.findById(roomId)
  // IDOR #668: si se pide mover a otra habitación (input.roomId explícito), debe pertenecer al
  // MISMO hotel que la reserva — si no, no hay que exponer basePrice ni disponibilidad de un
  // cuarto ajeno vía el quote (GET dry-run) ni permitir el commit (reusa updateReservation, que
  // ahora también lo verifica, pero cortar acá evita el leak de información en el quote).
  if (input.roomId && (!room || room.hotelId !== existing.hotelId)) {
    throw new ConflictError('La habitación no pertenece a este hotel')
  }
  const basePrice = Number(room?.basePrice) || 0
  const newNights = nightsBetween(checkIn, checkOut)
  const oldNights = nightsBetween(existing.checkIn, existing.checkOut)
  const previousTotal = Number(existing.totalAmount) || 0
  // La diferencia cobra las NOCHES AGREGADAS a tarifa base — NO reprecia toda la estadía
  // (el total original pudo salir de otra tarifa/temporada). Extender = +noches × basePrice.
  const difference = round2(basePrice * (newNights - oldNights))
  const quotedNewPrice = round2(previousTotal + difference)
  return {
    reservationId: existing.id,
    roomId, checkIn, checkOut, basePrice, oldNights, newNights, previousTotal, quotedNewPrice,
    difference,
    roomChanged: String(roomId) !== String(existing.roomId),
    datesChanged: checkIn !== existing.checkIn || checkOut !== existing.checkOut,
    currency: existing.currency || 'USD',
  }
}

/** Dry-run: valida disponibilidad y calcula la diferencia. NO escribe nada. */
export async function quoteReschedule(deps: RescheduleDeps, id: string, input: RescheduleInput, user: { id: string; role: string; hotelId?: string }): Promise<RescheduleQuote & { available: boolean; reason: string }> {
  const existing = await deps.repo.findById(id)
  assertOwnership(existing, user)
  const quote = await buildQuote(deps.roomRepo, existing, input)
  let available = true
  let reason = ''
  try {
    await assertRoomAvailable(deps.repo, quote.roomId, quote.checkIn, quote.checkOut, id)
  } catch (e: any) {
    available = false
    reason = e.message
  }
  return { ...quote, available, reason }
}

/** Aplica el cambio de habitación/fechas y cobra la diferencia según el método elegido. */
export async function commitReschedule(deps: RescheduleDeps, id: string, input: RescheduleInput, user: { id: string; role: string; hotelId?: string }): Promise<{ reservation: any; quote: RescheduleQuote & { chargeAmount: number; newTotal: number }; charge: RescheduleChargeResult | null }> {
  const existing = await deps.repo.findById(id)
  assertOwnership(existing, user)
  const quote = await buildQuote(deps.roomRepo, existing, input)

  const charge = input.charge
  const overridden = charge && typeof charge.amount === 'number'
  const chargeAmount = charge ? (overridden ? round2(charge.amount as number) : Math.max(0, quote.difference)) : 0
  // Si el recepcionista fija un monto a mano, el total es lo previo + lo cobrado; si no, el precio de rack.
  const newTotal = overridden ? round2(quote.previousTotal + chargeAmount) : quote.quotedNewPrice

  // Reusa updateReservation: revalida solape (assertRoomAvailable) y emite el socket + invalida caché.
  const reservation = await updateReservation(
    deps.repo, deps.logger, deps.cache, deps.sockets, id,
    { roomId: quote.roomId, checkIn: quote.checkIn, checkOut: quote.checkOut, totalAmount: newTotal } as any,
    user,
    deps.roomRepo,
  )

  deps.audit?.({
    reservationId: id, hotelId: existing.hotelId, userId: user.id,
    from: { roomId: existing.roomId, checkIn: existing.checkIn, checkOut: existing.checkOut, total: quote.previousTotal },
    to: { roomId: quote.roomId, checkIn: quote.checkIn, checkOut: quote.checkOut, total: newTotal },
    chargeAmount, method: charge?.method || null,
  })

  let chargeResult: RescheduleChargeResult | null = null
  if (charge && chargeAmount > 0 && deps.chargePort) {
    chargeResult = await deps.chargePort({
      reservationId: id, hotelId: existing.hotelId, guestId: existing.guestId || null, roomId: quote.roomId,
      currency: quote.currency, amount: chargeAmount, method: charge.method, reason: charge.reason,
      successUrl: input.successUrl, cancelUrl: input.cancelUrl,
    }, user)
  }

  return { reservation, quote: { ...quote, chargeAmount, newTotal }, charge: chargeResult }
}
