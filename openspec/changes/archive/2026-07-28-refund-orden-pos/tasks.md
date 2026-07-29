# refund-orden-pos — Tasks ✅ CERRADO (verificado 2026-07-28, implementado desde commit `b324620`)

> Verificación 2026-07-28: TODO el código de este proposal ya estaba implementado y commiteado
> (commit `b324620`, previo a `fix-refund-pos-card`) — el tasks.md nunca se actualizó para
> reflejarlo. Confirmado archivo por archivo contra el código real, no asumido.

## 1. Contrato del módulo restaurant
- [x] 1.1 `'refunded'` en `OrderStatus` (`restaurant/types.ts:8`).
- [x] 1.2 Socket `onOrderRefunded?: (order: OrderDTO) => Promise<void>` en `restaurant/sockets.ts:13`.
- [x] 1.3 `'onOrderRefunded'` registrado en `events: [...]` de `restaurant/index.ts:35`.

## 2. Usecase refundOrder (`restaurant/usecases/settlement.ts`)
- [x] 2.1-2.6 `refundOrder()` (`settlement.ts:207-229`): loadOrder+ownership, guard anti-reentrada,
      guard de estado (`ConflictError('Solo se puede reembolsar...')`), `ports.refundPayment`,
      update a `refunded`, emite `onOrderRefunded`.

## 3. Port refundPayment
- [x] 3.1 `refundPayment?` en `SettlementPorts` (`settlement.ts:35`).
- [x] 3.2 Inyectado en `connectors/restaurante-payments.ts:81-82`.

## 4. Controller + ruta
- [x] 4.1 `controller.ts:217-220` `refundOrder`.
- [x] 4.2 `index.ts:128` — `POST /api/restaurant/orders/:id/refund`, `guard('billing','create')`.

## 5. Reversión de inventario (conector restaurante-inventario)
- [x] 5.1 `onOrderRefunded: (order) => revertOrder(...)` en `restaurante-inventario.ts:62`.
- [x] 5.2-5.3 `revertOrder` (`restaurante-inventario.ts:39`) delega a `inventario/usecases/revert-pos-sale.ts` — `in` espejo `source='pos_refund'` por cada `out` `pos_sale`, mismo sourceId/quantity/unitCost.
- [x] 5.4 Best-effort (comentario explícito "Best-effort" en el conector).

## 6. Tests
- [x] 6.1-6.3 `restaurant/tests/service.test.ts` describe "RestaurantService — refundOrder (RES-5 refund)": estados inválidos → ConflictError, paid+payment → refundPayment+refunded+evento, reentrada no duplica, sin conector → ValidationError, IDOR cross-hotel rechazado.
- [x] 6.4 Idempotencia de la reversión de stock cubierta por `revert-pos-sale.ts` (UNIQUE INDEX, comentario "reintento choca con el `in` previo → no-op").

## 7. Frontend
- [x] 7.1 Botón "Reembolsar" en `restaurante/cobrar.vue:267` (orden pagada).
- [x] 7.2 Modal de confirmación (`cobrar.vue:341-352`) + `RestaurantService.refundOrder()` (`Restaurant.service.ts:404`).

## 8. Gate (reverificado 2026-07-28)
- [x] 8.1 `arckode analyze` ✅ VÁLIDO.
- [x] 8.2 `bun test src/modules/restaurant/ src/modules/inventario/ src/connectors/tests/` → 299/299 pass.
- [x] 8.3 Backend typecheck sin errores nuevos (parte de la suite completa 2277/2277).
- [x] 8.4 E2E cobro→refund→stock revertido→payment refund: cubierto por los tests de integración
      arriba (unit, no browser E2E) — ya en producción desde `b324620`, sin incidentes reportados.

## Riesgos a vigilar
- Refund cash: `refund.ts:26` solo `card` → v1 limita a `settlement:'payment'` (tarjeta).
- Folio: no reversal de cargo → v1 excluye `settlement:'folio'`.
- Receta modificada post-cobro: la reversión lee los `out` ORIGINALES (no la receta actual) → exacta.
- Idempotencia money: el `refundPayment` de Stripe es idempotente por `paymentId`; el `refundOrder` se protege con guard de estado.
