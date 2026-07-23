// treasury/sockets.ts — Hooks opcionales. El módulo funciona sin ellos.
import type { SupplierDTO } from './types'

export interface TreasurySockets {
  onSupplierCreated?: (data: SupplierDTO) => Promise<void>
}
