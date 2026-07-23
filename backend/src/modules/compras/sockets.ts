// compras/sockets.ts — Eventos que emite el módulo (para conectores). Best-effort.
import type { PurchaseOrderDTO, GoodsReceiptDTO } from './types'

export interface ComprasSockets {
  onOrderReceived?: (order: PurchaseOrderDTO) => void | Promise<void>
  onGoodsReceived?: (receipt: GoodsReceiptDTO) => void | Promise<void>
}
