// roles/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { RolesDTO } from './types'

export interface RolesSockets {
  onRolesCreated?: (data: RolesDTO) => Promise<void>
  onRolesUpdated?: (data: RolesDTO) => Promise<void>
  onRolesDeleted?: (id: string) => Promise<void>
}
