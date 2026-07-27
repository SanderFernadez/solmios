// restaurant/sockets.ts — Hooks OPCIONALES hacia otros módulos / tiempo real.
// El módulo funciona sin ellos. Los conectores (RES-5 folios/payments, RES-6 accounting) y el
// bus de KDS (RES-4) pasan sockets para reaccionar a eventos. Ver design.md.
import type { OrderDTO, OrderItemDTO } from './types'

export interface RestaurantSockets {
  // KDS en tiempo real (RES-4)
  onOrderSent?: (order: OrderDTO, lines: OrderItemDTO[]) => Promise<void>
  onLineStatusChanged?: (line: OrderItemDTO) => Promise<void>
  // Liquidación (RES-5/RES-6): cargo a folio vs cobro directo → contabilidad
  onOrderCharged?: (order: OrderDTO) => Promise<void>   // cargado a la habitación (folio)
  onOrderPaid?: (order: OrderDTO) => Promise<void>      // cobrado directo (payment) → asiento de ingreso
  onOrderRefunded?: (order: OrderDTO) => Promise<void>  // reembolso de cobro directo (payment) → reversión contable + inventario
}
