# refund-orden-pos

## Intent

Permitir **anular/reembolsar una orden de restaurante ya cobrada**, revirtiendo el pago (Stripe, tarjeta) y el inventario que se descontó al cobrar. Hoy **no existe el flujo**: `cancelOrder` prohíbe cancelar `charged`/`paid` (`restaurant/usecases/orders.ts:117`), no hay estado `refunded`, ni endpoint, ni socket. Como consecuencia, anular una venta cobrada no revierte el stock (descuentas al cobrar, nunca revertís) y el dinero cobrado no se devuelve.

## Contexto

- Al cobrar (`onOrderPaid`/`onOrderCharged`), el conector `restaurante-inventario.ts` descuenta inventario por la receta (`consumeForSale`, movimientos `out` con `source='pos_sale'`, idempotentes).
- No existe el inverso: anular una venta cobrada no revierte nada.
- `payments/usecases/refund.ts` ya devuelve un cobro con tarjeta (crea un payment `type:'refund'`), pero **solo `method==='card'`** y **no está conectado a la orden POS** (el payment solo tiene `metadata.source='restaurant'`, sin `orderId`).

## Scope (v1 — seguro)

- Refund de órdenes con `status === 'paid'` y `settlement === 'payment'` (cobro directo con **tarjeta**).
- **Reversión exacta** del inventario: iterar los movimientos `out` originales (`source='pos_sale'`, `sourceId LIKE '${lineId}:%'`) y crear un `in` espejo (`source='pos_refund'`, mismo `sourceId`, mismo `unitCost`, misma `quantity`). Idempotente vía UNIQUE INDEX `idx_stock_mov_source`.
- Estado de orden `refunded`.

## Out of scope (v2)

- Reversión de cargo a **folio** (`settlement === 'folio'`): no hay reversal del cargo hoy; exige anulación manual en folios primero.
- Refund de **cash**: `refund.ts` solo soporta `card`.
- **Asiento contable** de reversión (nota de crédito): falta `recordRestaurantSaleRefund` en accounting.

## Decisión de despliegue (2026-07-24)

NO implementar como parche de tarde. Es feature de **dinero** (refund vía Stripe + reversión de inventario) que merece change openspec + QA robusto. Mismo criterio que RES-5 (idempotencia POS).
