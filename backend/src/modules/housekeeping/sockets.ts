// housekeeping/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { HousekeepingDTO } from './types'

export interface HousekeepingSockets {
  onHousekeepingCreated?: (data: HousekeepingDTO) => Promise<void>
  onHousekeepingUpdated?: (data: HousekeepingDTO) => Promise<void>
  onHousekeepingDeleted?: (id: string) => Promise<void>
}
