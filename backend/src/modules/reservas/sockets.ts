// reservas/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { ReservasDTO } from './types'

export interface ReservasSockets {
  onReservasCreated?: (data: ReservasDTO) => Promise<void>
  onReservasUpdated?: (data: ReservasDTO) => Promise<void>
  onReservasDeleted?: (id: string) => Promise<void>
  // `guestId`/`totalAmount` viajan en el payload para que el CRM pueda acreditar puntos sin volver a
  // leer la reserva (un conector delega, no consulta). Ambos pueden faltar: hay reservas sin huésped.
  onReservationCheckedOut?: (data: { reservationId: string; roomId: string; hotelId: string; guestId?: string | null; totalAmount?: number }) => Promise<void>
  // F2 plan #627 — Cancelación con política: notifica a módulos que reaccionan al reembolso
  // (deposits release/refund, CRM, channel manager availability push). Montos exactos del
  // cálculo para que el conector no tenga que recalcular.
  onReservationCancelled?: (data: { reservationId: string; hotelId: string; refundAmount: number; cancellationFee: number; policyApplied: any }) => Promise<void>
}
