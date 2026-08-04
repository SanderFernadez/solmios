// shared/usecases/room-overlap.ts — Criterio ÚNICO de solapamiento de fechas para una reserva activa.
// Extraído para que TODO consumidor (reservas/usecases/availability.ts, shared/usecases/
// public-api-availability.ts, y shared/usecases/habitaciones-availability.ts) comparta el MISMO
// criterio: excluye `cancelled`/`no_show`, `checkIn < checkOut && checkOut > checkIn`. Antes de
// esto el criterio estaba duplicado en 2 lugares (reservas/availability.ts inline + public-api
// con su propio `overlapsRange`) — sin esta fuente única, la UI del panel STAFF y el backend
// podían divergir en qué es "disponible" (causa raíz de #645/#648).
export interface OverlapCandidate {
  checkIn: string
  checkOut: string
  status?: string
}

export function overlapsRange(r: OverlapCandidate, checkIn: string, checkOut: string): boolean {
  if (r.status === 'cancelled' || r.status === 'no_show') return false
  return r.checkIn < checkOut && r.checkOut > checkIn
}
