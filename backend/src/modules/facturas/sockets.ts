// facturas/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { FacturasDTO } from './types'

export interface FacturasSockets {
  onFacturasCreated?: (data: FacturasDTO) => Promise<void>
  onFacturasUpdated?: (data: FacturasDTO) => Promise<void>
  onFacturasDeleted?: (id: string) => Promise<void>
}
