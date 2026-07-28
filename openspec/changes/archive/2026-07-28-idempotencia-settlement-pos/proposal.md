# idempotencia-settlement-pos

## Estado: ✅ CERRADO (2026-07-28)

Implementado (commit `1fee1f8`): unique index parcial `payments_pos_ref` / `folio_charges_pos_ref`
+ dedup atómico (claim-first) en `payment-crud.create`/`folio-entries.postCharge`. Verificado en
esta sesión: 10/10 tests propios pasan, y los 2 índices únicos existen realmente en la DB de
producción (`pg_indexes`, consultado directo). Desplegado.

## Intent

Que el **settlement del POS sea idempotente**: un reintento (doble click concurrente, crash entre `createPayment` y el update de la orden, reintento de red) **NO duplique el cobro ni el cargo a folio**. Hoy el guard por estado (`assertSettleable`) solo cubre el reintento *secuencial con update exitoso previo* — deja abiertos 3 escenarios reales de duplicación.

## Contexto (verificado 2026-07-24)

`restaurant/usecases/settlement.ts` hace "dinero primero, estado después":
- `payOrder` (:105) → `recordPayment` (:123) → `orders.update({status:'paid'})` (:128).
- `chargeToRoom` (:68) → `chargeToFolio` (:86) → `orders.update({status:'charged'})` (:91).

`assertSettleable` (:31) solo frena si la orden YA está `charged`/`paid`/cancelada. **No frena concurrencia (TOCTOU)** ni crashes intermedios.

Deuda documentada en el propio código (`settlement.ts:82-85, 120-122`): "si el update fallara tras un payment completed, un reintento duplicaría el cobro".

## Escenarios de duplicación (hoy NO cubiertos)

| # | Secuencia | Síntoma |
|---|---|---|
| **A — race (doble click)** | `POST /orders/X/pay` ×2 en paralelo. Ambos ven `status:'billed'` → `assertSettleable` OK en los dos → 2 `createPayment`. | **2 payments** por el total |
| **B — crash intermedio** | `recordPayment` P1 (completed) → crash antes de `orders.update`. Reintento → P2. | **2 payments**, orden final `paid` con `paymentId=P2` (P1 huérfano) |
| **C — chargeToRoom** | Crash entre `chargeToFolio` y `orders.update`. Reintento → otro `postCharge` al folio. | **2 cargos restaurante** → saldo del huésped inflado |

## Decisión (2026-07-24)

NO parchear (feature de dinero + concurrencia). Mismo criterio que `refund-orden-pos` y `depositos-stripe-holds`.

## Approach (alineado al patrón nativo del framework)

**Idempotency key `'pos:' + orderId`** + **unique index parcial** (claim-first atómico, idéntico a `PaymentEventStore.settleOnce` para webhooks). El dedup **no puede ir en el usecase** (el módulo restaurant no importa `payments`/`folios`); va en el conector + dedup atómico en el módulo destino. El unique index es la **única barrera real** contra concurrencia (un `findMany + create` es TOCTOU y pierde el caso A).

## Scope

- `payments.reference = 'pos:' + orderId` (prefijo `pos:` → partial unique index, no choca con refs de Stripe/banco).
- `folio_charges.reference = 'pos:' + orderId` (requiere agregar `reference` a `PostChargeDTO` + modelo `folio_charges`).
- Dedup atómico en `payment-crud.create` y `folio-entries.postCharge`: `create` que captura el duplicate-key error → devuelve el registro existente (buscado por `reference`).

## Out of scope

- Reutilizar `PaymentEventStore` (su scope hoy es webhooks de pasarela; meter POS ahí ensucia el abstraction — más limpio replicar el claim-first).
- Idempotency para cash POS (no genera `payment` por card-vía-Stripe; ya tiene el guard de estado + la operación es directa).

## Riesgos

- **Unique index es la única barrera real** — sin él, todo es TOCTOU. Migration manual (el ORM no crea UNIQUE compuesto).
- `reference` ya carga semántica de "ref externo" (Stripe session, bank ref). Prefijo `pos:` evita colisión.
- `chargeToRoom` tiene sub-pasos `list→open→postCharge`; un fallo entre `open` y `postCharge` puede abrir un folio vacío (deuda preexistente, fuera de este scope).
