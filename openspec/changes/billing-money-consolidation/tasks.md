# Tasks: billing-money-consolidation

## BM-1 — El cobro de una factura registra un pago real

- [x] 1.1 `facturas/usecases/payment-port.ts` — declarar `PaymentPort { recordPayment(...) }`
- [x] 1.2 `connectors/facturas-payments.ts` — inyectar `payments.createPayment()` en `facturas`
- [x] 1.3 `facturas.pay()` usa el puerto; elimina `createPaymentRecord` (deja de escribir `type:'payment'`)
- [x] 1.4 Registrar el connector en `composition-root.ts`
- [x] 1.5 `facturas/tests/pay-invoice.test.ts` ("BM-1.5"): cobro en efectivo normaliza method→'cash', registra 1 fila en `payments` y marca `paid`.
- [x] 1.6 `facturas/tests/pay-invoice.test.ts` ("BM-1.6"): dos cobros (efectivo 60 + tarjeta 40) → 2 filas en `payments`, ningún método pisado, `amountPaid` acumula a 100.

## BM-2 — El pago a un folio registra un pago real

- [x] 2.1 `folios.applyPayment()` registra en `payments` vía puerto, manteniendo la línea en `folio_charges`
- [x] 2.2 `connectors/folios-payments.ts`
- [x] 2.3 `folios/tests/folio-payment.test.ts` ("BM-2.3"): el saldo baja por la línea auxiliar (kind=payment), sin doble descuento.
- [x] 2.4 `folios/tests/folio-payment.test.ts` ("BM-2.4"): el pago aparece en `payments` con `folioId` y method normalizado.

> BM-1 y BM-2 aplicados y verificados end-to-end (ver state.yaml). Tests 1.5/1.6/2.3/2.4 verificados
> el 2026-07-28: ya estaban escritos y commiteados (commits `d45871a`/`bfcfacb` y equivalente en
> folios), solo faltaba marcar el checklist. `bun test` 2277/2277 pass.

## BM-3 — Migración de datos

- [x] 3.1 `scripts/migrate-payments-out-of-invoices.ts` — copia `invoices.type='payment'` → `payments` · script completo (multi-motor, dry-run)
- [x] 3.2 Dedup idempotente por (`invoiceId`, `reference`, `amount`) · verificado: re-correr da 0 a migrar
- [x] 3.3 Guard: aborta si `SUM(amount)` pre != post · verificado: delta 120 == 120, guard OK
- [x] 3.4 `metadata.migratedFrom = 'invoices'` para permitir rollback · incluye sourceInvoiceId/Number
- [x] 3.5 Correr en SQLite local sobre copia y verificar sumas · verificado en dev (1 cobro migrado, guard OK)
- [x] 3.6 Dry-run contra Postgres de prod (sin escribir) · soporta `DATABASE_URL --dry-run`; prod no-op (0 invoices type='payment')

## BM-4 — Limpieza

- [x] 4.1 (2026-07-28) `InvoiceType` → `'invoice' | 'credit_note'` en `facturas/types.ts` +
      `TYPE_ENUM` en `validators/schema.ts`. Rama muerta `type==='payment'?'paid':'pending'` en
      `billing.ts:buildInvoiceRecord` simplificada a `'pending'` (era inalcanzable: el validator ya
      rechaza `type:'payment'`). Tests que simulaban filas legacy (`payment`/`folio`) actualizados
      con `as any` + comentario — documentan que es dato histórico, no un tipo válido nuevo.
- [x] 4.2 (2026-07-28) Frontend: `Billing.service.ts` (`InvoiceType`, `TYPE_MAP`) y
      `billing/index.vue:typeLabel()` sin las entradas muertas. Una fila legacy cae al fallback
      `'invoice'` de `mapInvoice()`.
- [x] 4.3 Tab "Pagos" lee `/api/payments` (con método, referencia y estado reales) · `billing/index.vue:loadData` ya migrado a `/api/payments`; eliminada la rama muerta que creaba `type:'payment'` suelto (BM-4.3)
- [x] 4.4 (2026-07-28) `stats.ts`: filtro **mantenido** (no simplificado) — se documentó por qué:
      es defensa ante datos legacy que pudieran existir en otro entorno (prod verificado en 0 filas,
      pero no es garantía universal). Comentario actualizado explicando que ya no se generan filas
      nuevas de esos tipos.
- [x] 4.5 (2026-07-28) `CLAUDE.md` actualizado: sección "`invoices` guarda TRES tipos" reemplazada
      por "`payments` es la ÚNICA fuente de verdad del dinero", reflejando el estado real post-BM.

## Gate

- [x] `bun run tsc --noEmit` (backend) sin errores nuevos · `bun test` 2277/2277 pass.
- [x] `arckode analyze` → ✅ VÁLIDO, 0 violaciones.
- [x] `vue-tsc -b --noEmit` (frontend) sin errores · `bun run build` → `✓ built`.
- [x] Verificación end-to-end: ya cubierta por BM-1/BM-2 (verificados end-to-end contra SQLite en
      su momento, ver state.yaml) + los tests unitarios BM-1.5/1.6/2.3/2.4 arriba.
- [x] Suma de dinero pre-migración == post-migración: cubierto por BM-3.3 (guard `SUM(amount)`
      pre==post, delta 120==120 verificado en dev) y BM-3.6 (dry-run contra Postgres de prod:
      0 invoices `type='payment'` — no hay nada que migrar en el entorno real).
