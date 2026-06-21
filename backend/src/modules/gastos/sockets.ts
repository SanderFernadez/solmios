// gastos/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { GastosDTO } from './types'

export interface GastosSockets {
  onGastosCreated?: (data: GastosDTO) => Promise<void>
  onGastosUpdated?: (data: GastosDTO) => Promise<void>
  onGastosDeleted?: (id: string) => Promise<void>
}
