// bookingengine/usecases/stay-restrictions.ts — Qué NO se puede vender en un rango de estadía.
//
// Lógica PURA (sin DB ni HTTP) que responde dos preguntas para un rango `[checkIn, checkOut)`:
//   1. ¿Qué habitaciones están BLOQUEADAS? (`room_blocks` — mantenimiento / uso interno).
//   2. ¿Qué tipos están CERRADOS por stop-sell? (`room_rates.closed`).
//
// ─── Por qué existe ─────────────────────────────────────────────────────────────────────────
// Las dos cosas ya se respetaban en el push ARI a Channex (`canales`) y en el calendario público
// (`public-calendar.ts`), pero NO en `AvailabilityUseCase` — el motor que alimenta `/rates`,
// `POST /api/public/availability` y la resolución de habitación de `POST /api/public/booking`.
// Resultado: una habitación bloqueada por mantenimiento estaba cerrada en Booking/Airbnb y
// abierta en la web propia del hotel, y una noche con stop-sell se veía "cerrada" en el
// calendario pero se cotizaba y se vendía igual desde el buscador.
//
// Vive en un archivo propio (mismo precedente que `rate-resolution.ts`) porque lo necesitan DOS
// usecases del módulo — `availability.ts` (lectura) y `public-booking.ts` (escritura) — y la
// regla tiene que ser LA MISMA en los dos: si el motor no lo ofrece, el POST tampoco lo acepta.
//
// ─── Semántica de fechas ────────────────────────────────────────────────────────────────────
// Reserva/estadía: `[checkIn, checkOut)` — la noche del checkout no existe (turnover).
// Bloqueo:         `[startDate, endDate]` — INCLUSIVO en los dos extremos.
// El cruce no se reimplementa acá: se delega en `computeDailyAvailability`
// (`shared/utils/daily-availability.ts`), la misma función pura que usan el push a Channex y
// `/calendar`. Si el criterio de borde cambiara alguna vez, cambia en un solo lugar.
import {
  computeDailyAvailability,
  eachDayExclusive,
  type OccupyingBlock,
} from '../../../shared/utils/daily-availability'
import { baseRatesOnly, buildSeasonByDate, pickRate } from './rate-resolution'

/**
 * Noches REALES de la estadía: `[checkIn, checkOut)`. Son exactamente las celdas que pinta
 * `/calendar` entre `from=checkIn` y `to=checkOut - 1 día`, así que los dos endpoints deciden
 * sobre el mismo conjunto de fechas.
 */
export function stayNights(checkIn: string, checkOut: string): string[] {
  return eachDayExclusive(checkIn, checkOut)
}

/**
 * Habitaciones que un `room_block` pisa en alguna noche del rango.
 *
 * Una habitación es UNA unidad: se le pasa `count = 1` a `computeDailyAvailability` y queda
 * bloqueada si CUALQUIER noche cae en 0. No hay "media habitación disponible": si el hotel la
 * cerró la noche del medio, la estadía completa no se puede vender en esa unidad.
 */
export function blockedRoomIds(blocks: any[], nights: string[]): Set<string> {
  const out = new Set<string>()
  if (nights.length === 0) return out

  const byRoom = new Map<string, OccupyingBlock[]>()
  for (const b of blocks) {
    if (!b?.roomId) continue
    const startDate = String(b.startDate ?? '').slice(0, 10)
    const endDate = String(b.endDate ?? '').slice(0, 10)
    if (!startDate || !endDate) continue
    const list = byRoom.get(b.roomId) ?? []
    list.push({ startDate, endDate })
    byRoom.set(b.roomId, list)
  }

  for (const [roomId, list] of byRoom) {
    const perDay = computeDailyAvailability(nights, 1, [], list)
    if (perDay.some((d) => d.available <= 0)) out.add(roomId)
  }
  return out
}

/** Stop-sell de una fila de `room_rates`. Único criterio, compartido con `/calendar`. */
export function isRateClosed(rate: any): boolean {
  return !!rate && Number(rate.closed) > 0
}

/**
 * Tipos de habitación con stop-sell para el rango, en minúsculas (`room.type` es un string
 * libre — no hay entidad RoomType propia en este PMS).
 *
 * ⚠️ CRITERIO — stop-sell PARCIAL: si la tarifa del tipo está `closed` en AL MENOS UNA noche del
 * rango, el tipo NO se vende para el rango COMPLETO. No se prorratea ni se ofrece "las noches
 * que sí": una estadía es atómica (un huésped no puede dormir 2 de 3 noches y salir a la calle
 * la del medio), y el hotel que cierra una noche está cerrando la posibilidad de ocupar esa
 * unidad esa noche. Es además el criterio que deja `/rates` consistente con `/calendar`: el
 * calendario ya pinta esa noche sin las unidades del tipo cerrado, así que si `/rates` cotizara
 * el rango el huésped avanzaría hacia una reserva que el calendario ya dice imposible.
 *
 * Solo mira tarifas BASE (`channel` vacío) y la temporada de cada fecha, con la MISMA resolución
 * de fila que el precio (`pickRate`): un stop-sell puesto en el override de una OTA no cierra el
 * canal directo, igual que el precio de esa OTA no se filtra al precio público.
 */
export function closedRoomTypes(
  rates: any[],
  assignments: any[],
  nights: string[],
  guests: number,
): Set<string> {
  const closed = new Set<string>()
  if (nights.length === 0) return closed
  const baseRates = baseRatesOnly(rates)
  if (baseRates.length === 0) return closed

  const seasonByDate = buildSeasonByDate(assignments)
  const types = new Set(
    baseRates.map((r) => String(r.roomType ?? '').toLowerCase()).filter((t) => t.length > 0),
  )
  for (const type of types) {
    for (const date of nights) {
      const rate = pickRate(baseRates, type, seasonByDate.get(date) ?? null, guests)
      if (isRateClosed(rate)) { closed.add(type); break }
    }
  }
  return closed
}

/** Lookup case-insensitive contra el Set de `closedRoomTypes`. */
export function isRoomTypeClosed(closed: Set<string>, roomType: string): boolean {
  return closed.has(String(roomType ?? '').toLowerCase())
}
