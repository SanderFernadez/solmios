// inventario/sockets.ts — Eventos que emite el módulo (para conectores). Best-effort.
import type { InventoryItemDTO } from './types'

export interface InventarioSockets {
  /** Se emite cuando el stock de un ítem cambia (útil para alertas de bajo-mínimo). */
  onStockChanged?: (item: InventoryItemDTO) => void | Promise<void>
}
