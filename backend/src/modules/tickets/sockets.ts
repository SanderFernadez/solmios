// tickets/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { TicketsDTO } from './types'

export interface TicketsSockets {
  onTicketsCreated?: (data: TicketsDTO) => Promise<void>
  onTicketsUpdated?: (data: TicketsDTO) => Promise<void>
  onTicketsDeleted?: (id: string) => Promise<void>
}
