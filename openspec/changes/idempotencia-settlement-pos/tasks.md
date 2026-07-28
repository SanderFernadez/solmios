# idempotencia-settlement-pos — Tasks

## 1. Contrato del settlement (`restaurant/usecases/settlement.ts`)
- [x] 1.1 `RecordPaymentInput` y `ChargeToFolioInput` reciben `orderId: string` (required).
- [x] 1.2 Pasar `orderId` al llamar al port en `payOrder` (:123) y `chargeToRoom` (:86).

## 2. Conector restaurante-payments
- [x] 2.1 `recordPayment` pasa `reference: 'pos:' + orderId` y `metadata: { source: 'restaurant', orderId }`.

## 3. Conector restaurante-folios
- [x] 3.1 `chargeToFolio` pasa `reference: 'pos:' + orderId` al `PostChargeDTO`.

## 4. payments — dedup atómico
- [x] 4.1 `payments/usecases/payment-crud.ts create`: si `reference` comienza con `pos:`, claim-first (create que captura duplicate-key → buscar existente por `reference` y devolverlo).
- [x] 4.2 Identificar duplicate-key en ambos motores (SQLite `SQLITE_CONSTRAINT_UNIQUE` / PG `23505`).

## 5. folios — dedup atómico
- [x] 5.1 Agregar `reference?: string` a `PostChargeDTO` y al modelo `folio_charges` (`folios/model.ts`).
- [x] 5.2 `folios/usecases/folio-entries.ts postCharge`: claim-first por `reference` (mismo patrón que payments).

## 6. Migration (multi-motor — UNIQUE index parcial)
- [x] 6.1 `CREATE UNIQUE INDEX payments_pos_ref ON payments("hotelId","reference") WHERE reference LIKE 'pos:%'` (SQLite ≥3.8 y PG soportan partial unique index).
- [x] 6.2 `CREATE UNIQUE INDEX folio_charges_pos_ref ON folio_charges("hotelId","reference") WHERE source='pos'`.
- [x] 6.3 Idempotente (`IF NOT EXISTS`). Validar nombres físicos de columnas (`hotelId` vs `hotelid` — PG lowercase, ver patrón de habilitar módulos).

## 7. Tests (análogos a `payments/tests/webhook-idempotency.test.ts`)
- [x] 7.1 Doble `payOrder` concurrente (misma orden) → **1 payment** (el segundo reclamado).
- [x] 7.2 Crash entre `recordPayment` y `orders.update` → reintento **NO crea P2** (devuelve P1 por reference).
- [x] 7.3 Idem `chargeToRoom` → **1 cargo** al folio.

## 8. Gate (antes de deploy)
- [x] 8.1 `arckode analyze` 0 violaciones.
- [x] 8.2 `bun test` (restaurant + payments + folios).
- [x] 8.3 typecheck backend.
- [x] 8.4 e2e: doble submit de cobro (race) → un solo payment; crash simulado → reintento sin duplicar.
- [x] 8.5 Validar que la migration no falla por duplicados legacy en `payments`/`folio_charges` (pre-check `SELECT … GROUP BY reference HAVING COUNT(*)>1` antes del index).

## Notas
- El guard `assertSettleable` se mantiene (necesario para el reintento secuencial claro); el unique index cubre la concurrencia que aquel no puede.
- Patrón de referencia: `PaymentEventStore.settleOnce` (`services/payment-gateway/payment-events.ts:73-98`) — claim-first con PK atómica.
