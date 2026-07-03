// reservas/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { ReservasDTO } from './types'

export interface ReservasSockets {
  onReservasCreated?: (data: ReservasDTO) => Promise<void>
  onReservasUpdated?: (data: ReservasDTO) => Promise<void>
  onReservasDeleted?: (id: string) => Promise<void>
  onReservationCheckedOut?: (data: { reservationId: string; roomId: string; hotelId: string }) => Promise<void>
}
