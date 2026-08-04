// bookingengine/usecases/rate-resolution.ts — Resolución de PRECIO POR NOCHE (lógica pura).
//
// Única fuente de verdad del precio por fecha del motor directo. La usan DOS endpoints públicos
// que tienen que decir lo mismo o el huésped ve un precio en el calendario y otro al cotizar:
//   - `public-calendar.ts`  (`GET /api/public/hotels/:slug/calendar`) — precio de CADA noche.
//   - `public-rates.ts`     (`GET /api/public/hotels/:slug/rates`)    — total de la estadía.
//
// Vive en un archivo aparte (y no en `public-calendar.ts`, que fue donde nació) porque
// `public-calendar.ts` ya importa `readCurrencyRates` de `public-rates.ts`: que `public-rates`
// importara de vuelta del calendario cerraría un ciclo de módulos. Es lógica pura sin deps,
// así que el lugar correcto es un helper del propio módulo, no un connector ni `shared/`
// (no lo necesita ningún otro módulo).
//
// ─── La cadena de precio ────────────────────────────────────────────────────────────────────
//   season_assignments {hotelId, date, season}
//     → room_rates {roomType, occupancy, season, channel, basePrice, percentage, price, closed,
//                   minStay, maxStay}
//     → si no hay temporada asignada a esa fecha, o la temporada no tiene fila para ese tipo:
//       FALLBACK a `rooms.basePrice` (lo decide el caller, ver `resolveNightlyPrice`).
//
// Reglas (heredadas del push a Channex, `canales/usecases/push-rates.ts`, sin acoplarse a él):
//   - Solo tarifas BASE (`channel` vacío). El motor directo no vende por un canal OTA: un
//     override de 'airbnb'/'booking' no se filtra al precio público.
//   - Ocupación: exacta = `guests` si existe; si no, la menor que cubra al grupo; si no, la
//     mayor disponible. En `per_room` hay una sola fila por tipo y las tres reglas colapsan.
//   - `price` de la fila es el precio efectivo (`pricing/service.ts` lo persiste como
//     `basePrice × (1 + percentage/100)`). Si viniera en 0 se recompone de base+percentage.

/** `date (YYYY-MM-DD) → season`. Última fila gana si hubiera duplicados (no debería haberlos). */
export function buildSeasonByDate(assignments: any[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const a of assignments) {
    if (!a?.date || !a?.season) continue
    out.set(String(a.date).slice(0, 10), String(a.season))
  }
  return out
}

/** Tarifas BASE del hotel (sin override de canal). Ver cabecera: el motor directo no vende por OTA. */
export function baseRatesOnly(rates: any[]): any[] {
  return rates.filter((r) => !r.channel)
}

/**
 * Elige la fila de `room_rates` para (roomType, season, guests) entre las tarifas BASE.
 * `null` si no hay temporada asignada a esa fecha o el tipo no tiene tarifa cargada → el caller
 * cae a `rooms.basePrice`.
 */
export function pickRate(baseRates: any[], roomType: string, season: string | null, guests: number): any | null {
  if (!season) return null
  const want = String(roomType).toLowerCase()
  const candidates = baseRates.filter((r) =>
    String(r.roomType ?? '').toLowerCase() === want && String(r.season ?? '') === season)
  if (candidates.length === 0) return null

  const exact = candidates.find((r) => Number(r.occupancy) === guests)
  if (exact) return exact
  const covering = candidates
    .filter((r) => Number(r.occupancy) >= guests)
    .sort((a, b) => Number(a.occupancy) - Number(b.occupancy))[0]
  if (covering) return covering
  return candidates.sort((a, b) => Number(b.occupancy) - Number(a.occupancy))[0] ?? null
}

/** Precio efectivo de una fila de `room_rates`. `price` ya viene calculado por `pricing`; si
 *  llegara en 0 (fila legacy / derivada), se recompone desde `basePrice` + `percentage`. */
export function ratePrice(rate: any): number {
  const price = Number(rate?.price) || 0
  if (price > 0) return price
  const base = Number(rate?.basePrice) || 0
  const pct = Number(rate?.percentage) || 0
  return base > 0 ? round2(base * (1 + pct / 100)) : 0
}

/**
 * Precio de UNA noche para un tipo de habitación.
 *
 * `fallbackPrice` es el precio "sin temporadas" del tipo (`rooms.basePrice`) y se usa cuando esa
 * fecha no tiene temporada asignada, cuando la temporada no tiene fila para el tipo, o cuando la
 * fila existe pero no resuelve a un importe > 0. Ese fallback es lo que hace que un hotel SIN
 * temporadas cargadas (el caso de casi todos hoy) cotice exactamente igual que antes.
 */
export function resolveNightlyPrice(
  baseRates: any[],
  roomType: string,
  season: string | null,
  guests: number,
  fallbackPrice: number,
): number {
  const rate = pickRate(baseRates, roomType, season, guests)
  const price = rate ? ratePrice(rate) : 0
  return price > 0 ? price : fallbackPrice
}

/**
 * Total de la estadía para un tipo: SUMA del precio de cada noche, no `precio × noches`.
 * `nightDates` son las noches reales (`[checkIn, checkOut)` — la noche del checkout no existe).
 */
export function sumStayPrice(
  nightDates: string[],
  baseRates: any[],
  roomType: string,
  seasonByDate: Map<string, string>,
  guests: number,
  fallbackPrice: number,
): number {
  let total = 0
  for (const date of nightDates) {
    total += resolveNightlyPrice(baseRates, roomType, seasonByDate.get(date) ?? null, guests, fallbackPrice)
  }
  // round2 al final: sumar N veces el mismo float puede dejar cola binaria (33.33 × 3 = 99.99000…1).
  return round2(total)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
