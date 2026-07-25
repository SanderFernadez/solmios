# refund-orden-pos — Tasks

## 1. Contrato del módulo restaurant
- [ ] 1.1 Agregar `'refunded'` a `OrderStatus` (`restaurant/types.ts:5`).
- [ ] 1.2 Agregar socket `onOrderRefunded?: (order: OrderDTO) => Promise<void>` a `restaurant/sockets.ts`.
- [ ] 1.3 Registrar `'onOrderRefunded'` en `events: [...]` del `restaurant/index.ts`.

## 2. Usecase refundOrder (`restaurant/usecases/settlement.ts`)
- [ ] 2.1 `loadOrder` + ownership (`assertOwnership`).
- [ ] 2.2 Guard anti-reentrada: `if order.status === 'refunded' return order` al inicio.
- [ ] 2.3 Guard de estado: `if order.status !== 'paid' || order.settlement !== 'payment'` → `ConflictError('Solo se puede reembolsar una orden cobrada con tarjeta')`.
- [ ] 2.4 Llamar `ports.refundPayment?.({ paymentId: order.paymentId })` (nuevo port).
- [ ] 2.5 `orders.update(id, { status: 'refunded', closedAt })`.
- [ ] 2.6 Emitir `sockets.onOrderRefunded?.(updated)`.

## 3. Port refundPayment
- [ ] 3.1 Agregar `refundPayment?: (input: { paymentId: string }, user: CurrentUser) => Promise<void>` a `SettlementPorts` (`settlement.ts:14`).
- [ ] 3.2 Inyectar en `connectors/restaurante-payments.ts`: `refundPayment: ({ paymentId }) => payments().refundPayment(paymentId, undefined, { id:'system', role:'super_admin' })`.

## 4. Controller + ruta
- [ ] 4.1 `controller.ts:refundOrder` → llama `service.refundOrder`.
- [ ] 4.2 `index.ts`: `router.post('/api/restaurant/orders/:id/refund', guard('billing','create'), refundOrder)`. Permiso `billing:create` (alinea con `payments/:id/refund`), NO `restaurant:delete`.

## 5. Reversión de inventario (conector restaurante-inventario)
- [ ] 5.1 Agregar `onOrderRefunded: (order) => revertOrder(order)` al `setSockets`.
- [ ] 5.2 `revertOrder`: cargar líneas activas (no `cancelled`), y por cada `lineId` buscar los `out` originales (`source='pos_sale'`, `sourceId LIKE '${lineId}:%'`) y crear un `in` espejo (`source='pos_refund'`, MISMO `sourceId`, mismo `unitCost`, misma `quantity`).
- [ ] 5.3 Método en `InventarioService` (ej: `revertForRefund`) o reusar `applyExternalMovement` con `type:'in'`.
- [ ] 5.4 Best-effort + try/catch (la reversión nunca rompe el refund).

## 6. Tests
- [ ] 6.1 `refundOrder` de status `open`/`cancelled`/`charged` → `ConflictError`.
- [ ] 6.2 `refundOrder` de `paid` → llama `ports.refundPayment`, update a `refunded`, emite `onOrderRefunded`.
- [ ] 6.3 Reentrada: segundo `refundOrder` de la misma orden → devuelve sin duplicar (idempotente por estado).
- [ ] 6.4 Conector: tras `onOrderRefunded`, `applyMovement in source='pos_refund'` por cada `out`; segunda llamada no duplica (UNIQUE INDEX `idx_stock_mov_source`).

## 7. Frontend
- [ ] 7.1 Botón "Reembolsar" en ordenes pagadas (permiso `billing:create`).
- [ ] 7.2 Confirm + toast.

## 8. Gate (antes de deploy)
- [ ] 8.1 `arckode analyze` 0 violaciones.
- [ ] 8.2 `bun test` (restaurant + inventario).
- [ ] 8.3 typecheck backend + frontend.
- [ ] 8.4 e2e cobro→refund→stock revertido→payment refund.

## Riesgos a vigilar
- Refund cash: `refund.ts:26` solo `card` → v1 limita a `settlement:'payment'` (tarjeta).
- Folio: no reversal de cargo → v1 excluye `settlement:'folio'`.
- Receta modificada post-cobro: la reversión lee los `out` ORIGINALES (no la receta actual) → exacta.
- Idempotencia money: el `refundPayment` de Stripe es idempotente por `paymentId`; el `refundOrder` se protege con guard de estado.
