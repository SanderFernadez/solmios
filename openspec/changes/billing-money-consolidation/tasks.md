# Tasks: billing-money-consolidation

## BM-1 — El cobro de una factura registra un pago real

- [x] 1.1 `facturas/usecases/payment-port.ts` — declarar `PaymentPort { recordPayment(...) }`
- [x] 1.2 `connectors/facturas-payments.ts` — inyectar `payments.createPayment()` en `facturas`
- [x] 1.3 `facturas.pay()` usa el puerto; elimina `createPaymentRecord` (deja de escribir `type:'payment'`)
- [x] 1.4 Registrar el connector en `composition-root.ts`
- [ ] 1.5 Test: cobrar una factura en efectivo emite `onPaymentCompleted` (→ caja)
- [ ] 1.6 Test: dos cobros con métodos distintos → dos filas en `payments`, ningún método pisado

## BM-2 — El pago a un folio registra un pago real

- [x] 2.1 `folios.applyPayment()` registra en `payments` vía puerto, manteniendo la línea en `folio_charges`
- [x] 2.2 `connectors/folios-payments.ts`
- [ ] 2.3 Test: el saldo del folio no cambia (la línea auxiliar sigue existiendo)
- [ ] 2.4 Test: el pago aparece en `payments` con `folioId`

> BM-1 y BM-2 aplicados y verificados end-to-end (ver state.yaml).
> Tests 1.5/1.6/2.3/2.4 pendientes: la verificación fue e2e contra SQLite, falta cubrirlos con unit tests.

## BM-3 — Migración de datos

- [ ] 3.1 `scripts/migrate-payments-out-of-invoices.ts` — copia `invoices.type='payment'` → `payments`
- [ ] 3.2 Dedup idempotente por (`invoiceId`, `reference`, `amount`)
- [ ] 3.3 Guard: aborta si `SUM(amount)` pre != post
- [ ] 3.4 `metadata.migratedFrom = 'invoices'` para permitir rollback
- [ ] 3.5 Correr en SQLite local sobre copia y verificar sumas
- [ ] 3.6 Dry-run contra Postgres de prod (sin escribir)

## BM-4 — Limpieza

- [ ] 4.1 `InvoiceType` → `'invoice' | 'credit_note'`; quitar `folio`/`receipt`/`payment` del enum y validators
- [ ] 4.2 Frontend: `TYPE_MAP` y `typeLabel()` sin tipos muertos
- [x] 4.3 Tab "Pagos" lee `/api/payments` (con método, referencia y estado reales) · `billing/index.vue:loadData` ya migrado a `/api/payments`; eliminada la rama muerta que creaba `type:'payment'` suelto (BM-4.3)
- [ ] 4.4 `stats.ts`: el filtro `type==='invoice'` deja de ser necesario — documentar o simplificar
- [ ] 4.5 Actualizar `CLAUDE.md`: `payments` es la única fuente de verdad del dinero

## Gate

- [ ] `bun run typecheck` && `bun test`
- [ ] `arckode analyze` → ✅ sin violaciones
- [ ] `npx vue-tsc --noEmit` && `bun run build`
- [ ] Verificación end-to-end: cobro en efectivo → `cash_movements` +1
- [ ] Suma de dinero pre-migración == post-migración
