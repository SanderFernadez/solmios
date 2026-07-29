# Tasks: contabilidad-tesoreria

> Cada sprint (`## <ID> — título`) se sube a GitLab como un Issue. Los checkboxes son sub-tareas.
> Orden de ejecución: **Fase A (infra) → contabilidad → tesorería → transversal → gate**.
> Dependencias marcadas con `⟵ dep: <ID>`. In-house, `RepositoryAdapter<T>`, sin SQL crudo en services.

---

## Fase 1 — Infraestructura contable

### CTB-0 — Schema ORM + módulo `accounting` base + wiring  ✅ HECHO (commit accounting-module-ctb0)
- [x] 0.1 `make:module Accounting` → estructura canónica (index/model/service/controller/types/sockets/validators/tests)
- [x] 0.2 `model.ts`: modelos ORM `accounts`, `journal_entries`, `journal_lines`, `accounting_periods` (ver design.md)
- [x] 0.3 Registrar en `composition-root.ts` (módulo + permisos + moduleGuard `accounting`)
- [x] 0.4 `RUN_MIGRATE` crea las 4 tablas (verificado en SQLite; PG por deploy) · lowercase nativo fw 1.6.2
- [x] 0.5 Permisos `accounting:view/create/edit/delete` en `shared/permissions.ts` (hotel_admin completo)
- [x] 0.6 Clave de catálogo `accounting` en `admin/usecases/modules.ts` (entitlement de plan)
- **Aceptación:** ✅ `arckode analyze` 0 violaciones · 4 tablas creadas (RUN_MIGRATE) · 11 tests verdes · typecheck limpio.

### CTB-1 — Plan de cuentas (chart of accounts) + seed base  ⟵ dep: CTB-0
- [x] 1.1 CRUD de `accounts` (service + controller + validators), con `isPostable` y jerarquía `parentId` (validada por hotel)
- [x] 1.2 Endpoints `GET/POST/PUT/DELETE /api/accounting/accounts` (guard `accounting:*` + moduleGuard)
- [x] 1.3 Seed del catálogo base hotelero (36 cuentas, `usecases/seed-chart-of-accounts.ts`) — idempotente por hotel · endpoint `POST /api/accounting/seed`
- [x] 1.4 Validación: `code` único por hotel; no borrar cuenta con hijos ni con asientos (integridad referencial)
- [x] 1.5 Tests: seed crea el catálogo (idempotente); cuenta de agrupación rechaza asiento directo ✅
- **Aceptación:** un hotel nuevo obtiene el plan base; el catálogo es editable; tests verdes.

### CTB-2 — Asientos manuales + doble entrada + post/reverse  ✅ HECHO ⟵ dep: CTB-1
- [x] 2.1 `usecases/journal-entry.ts`: crear asiento con líneas debe/haber, validar `SUM(debit)=SUM(credit)` (epsilon 0.01, atómico por transacción)
- [x] 2.2 Rechazar líneas contra cuentas no-postable; rechazar descuadre, monto cero, débito+crédito en una línea, <2 líneas (`ValidationError`)
- [x] 2.3 `post` (draft→posted) y `reverse` (asiento espejo invertido `reversalOf` + original `reversed`, atómico); re-postear/revertir no-posteado rechazado
- [x] 2.4 Endpoints `POST /journal`, `/journal/:id/post`, `/journal/:id/reverse`, `GET /journal?period=`
- [x] 2.5 Tests: balanceado OK; descuadre/no-postable/débito+crédito rechazados; dedup; post; reversión invierte debe/haber. **+ integración real SQLite end-to-end** ✅
- **Aceptación:** ✅ asentar/postear/revertir funciona; nunca queda descuadrado; verificado con ORM real. Dedup por reference+referenceType listo para CTB-4.

### CTB-3 — Períodos contables (open/close/lock)  ✅ HECHO ⟵ dep: CTB-2
- [x] 3.1 `usecases/period.ts`: abrir período `YYYY-MM` (lazy al crear asiento), cerrar (valida cuadre del período), lock
- [x] 3.2 Al crear/postear, resolver el período por `entryDate`; rechazar si `closed`/`locked` (409)
- [x] 3.3 Endpoints `GET /periods`, `POST /periods/:id/close`, `POST /periods/:id/lock`
- [x] 3.4 Tests: asiento en período cerrado rechazado; cierre valida cuadre. **+ integración real** (cerrar → cobro no genera asiento) ✅
- **Aceptación:** ✅ los asientos caen en su período; un período cerrado no acepta más asientos.

### CTB-4 — Asientos automáticos (conectores desde eventos)  ✅ HECHO (núcleo) ⟵ dep: CTB-2/CTB-3
- [x] 4.1 `connectors/payments-accounting.ts`: `onPaymentCompleted`/`onRefundProcessed`/`onDepositCreated`/`onDepositReleased` → asiento, dedup por `reference`
- [~] 4.2 `facturas-accounting`: **DIFERIDO (decisión de diseño)** — el ingreso se devenga desde folio charges (consistente con `reports/money.ts`), NO desde facturas, para NO doble-contar. La factura es documento. Pendiente solo el asiento de nota de crédito.
- [x] 4.3 `connectors/gastos-accounting.ts`: `onGastosCreated` → gasto pagado (Caja/Bancos) vs impago (Cuentas por Pagar); nómina a su cuenta
- [x] 4.4 `connectors/folios-accounting.ts`: `onFolioCharged` (night audit + manual) → DR Clientes / CR Ingresos + ITBIS (habitación vs servicios por categoría)
- [~] 4.5 `cash-accounting` (diferencia de arqueo): **DIFERIDO** — refinamiento de bajo valor; el cash real ya se asienta por payments-accounting.
- [x] 4.6 Todos: no-op si el hotel no tiene plan de cuentas (self-gating por resolución de códigos); best-effort (try/catch, no rompe el origen); idempotentes por `reference`
- [x] 4.7 Registrar los 3 conectores núcleo en `composition-root.ts`
- [x] 4.8 Tests: cada evento genera el asiento correcto y cuadrado; re-emisión no duplica (dedup); sin plan de cuentas = no-op. **+ integración real SQLite end-to-end** ✅
- **Aceptación:** ✅ operar el hotel (cobrar, cargar folio, gastar) genera los asientos solo, balanceados, idempotentes, cero doble conteo (ingreso solo desde folio charges). facturas/cash diferidos con razón documentada.

### CTB-5 — Libro mayor + balance de comprobación  ✅ HECHO ⟵ dep: CTB-4
- [x] 5.1 `usecases/reports.ts::generalLedger`: mayor por cuenta (movimientos ordenados + saldo corriente)
- [x] 5.2 `usecases/reports.ts::trialBalance`: saldos deudor/acreedor por cuenta; verifica `SUM(débitos)=SUM(créditos)` (solo posteados)
- [x] 5.3 Endpoints `GET /ledger?account=`, `GET /trial-balance?period=`
- [x] 5.4 Tests: mayor suma correcto; trial balance cuadra. **+ integración real: DR 286 = CR 286** ✅
- **Aceptación:** ✅ el balance de comprobación siempre cuadra; el mayor refleja los asientos; los draft se excluyen.

### CTB-6 — Estados financieros (P&L + Balance general)  ✅ HECHO ⟵ dep: CTB-5
- [x] 6.1 `usecases/reports.ts::profitLoss`: Ingresos(4) − Gastos(5) = Resultado, base `accrual`. [~] base `cash` diferida (requiere trazar cobro→devengado; el ledger devenga por folio charges).
- [x] 6.2 `usecases/reports.ts::balanceSheet`: Activo = Pasivo + Patrimonio (incluye resultado del ejercicio)
- [x] 6.3 Endpoints `GET /pnl?from=&to=`, `GET /balance-sheet?period=`
- [x] 6.4 Tests: ingreso solo desde folio charges (sin doble conteo); balance cuadra. **+ integración real: P&L 100−50=50, Balance 68=18+50** ✅
- **Aceptación:** ✅ P&L y Balance general correctos y cuadrados; cero doble conteo (verificado end-to-end).

### Refactor (habilitante de CTB-5/CTB-6)
- [x] Extraído el CRUD de cuentas a `usecases/accounts-crud.ts` (service 192→100 líneas, headroom God Object).
- [x] Fixes del QA CTB-3/CTB-4: reembolso ahora se asienta (payments emite `onRefundProcessed`); depósitos NO cableados (no son plata real — deuda documentada); `lockPeriod` exige `closed`; cargo de folio deriva neto del total (siempre cuadra).

### CTB-7 — Frontend contabilidad  ✅ HECHO ⟵ dep: CTB-6
- [x] 7.1 `services/Accounting.service.ts` (cliente completo de la API)
- [x] 7.2 `pages/contabilidad/plan-cuentas.vue` (lista jerárquica + alta + seed base)
- [x] 7.3 `pages/contabilidad/libro-diario.vue` (asientos por período + alta manual con líneas + postear/revertir)
- [x] 7.4 `pages/contabilidad/mayor.vue` (mayor por cuenta con saldo corriente)
- [x] 7.5 `pages/contabilidad/reportes.vue` (tabs: comprobación, P&L, balance general)
- [x] 7.6 4 rutas `/panel/contabilidad/*` (requiresHotelAdmin) + sección de menú + module-map (accounting)
- **Aceptación:** ✅ `vue-tsc -b` limpio; `bun run build` OK (4 chunks generados); menú gateado por permiso + entitlement (patrón #428).

---

## Fase 2 — Tesorería

### TES-0 — Módulo `treasury` base + schema + wiring  ✅ HECHO
- [x] 0.1 Módulo `treasury` + modelos `bank_accounts`, `bank_movements`, `suppliers`, `budgets`
- [x] 0.2 Registrar en `composition-root.ts`; permisos `treasury:*` (+ MODULE_ACTIONS); clave de catálogo `treasury`
- [x] 0.3 `RUN_MIGRATE` crea las 4 tablas (verificado SQLite)
- **Aceptación:** ✅ `arckode analyze` 0 violaciones; 4 tablas creadas; módulo arranca.

### TES-1 — Cuentas bancarias + movimientos + conciliación  ✅ HECHO ⟵ dep: TES-0
- [x] 1.1 CRUD `bank_accounts` (`usecases/bank.ts`, opcional vínculo a cuenta contable `1.1.02` vía accountId)
- [x] 1.2 Import de `bank_movements` (array del body; dedup por cuenta+fecha+monto+ref, idempotente)
- [x] 1.3 `reconcile`: match `bank_movements` ↔ `payments` completados por monto exacto + fecha ±3 días; anti doble-match (un pago = un movimiento)
- [x] 1.4 Endpoints bank-accounts (CRUD), `/:id/import`, `/reconcile`
- [x] 1.5 Tests: import idempotente; match marca `reconciled=1`+paymentId; anti doble-match; diferencias reportadas
- **Aceptación:** ✅ se importan movimientos y se concilian contra pagos sin doble-match; las diferencias quedan visibles.

### TES-2 — Flujo de caja (cash flow)  ✅ HECHO ⟵ dep: TES-0
- [x] 2.1 `usecases/liquidity.ts::cashFlow`: entradas (`payments charge` completados) − salidas (`expenses paid`); excluye depósitos/no-completados
- [x] 2.2 Saldo acumulado de liquidez; agrupación día/mes
- [x] 2.3 Endpoint `GET /cash-flow?from=&to=&group=`
- [x] 2.4 Tests: entradas/salidas correctas; depósitos y pending excluidos; acumulado
- **Aceptación:** ✅ el flujo de caja refleja el dinero real sin doble conteo.

### TES-3 — Cuentas por cobrar (AR) con aging  ✅ HECHO ⟵ dep: TES-0
- [x] 3.1 `usecases/liquidity.ts::receivables`: saldo pendiente por huésped (`amount − amountPaid`, solo type='invoice')
- [x] 3.2 Aging: corriente, 1-30, 31-60, 61-90, +90 (desde `dueDate`/`issueDate`)
- [x] 3.3 Endpoint `GET /receivables`
- [x] 3.4 Tests: total AR correcto; buckets de aging; excluye 'payment' (no doble conteo)
- **Aceptación:** ✅ AR por huésped con aging; consistente con la regla type='invoice'.

### TES-4 — Cuentas por pagar (AP) + proveedores  ✅ HECHO ⟵ dep: TES-0
- [x] 4.1 CRUD `suppliers` (`usecases/suppliers-crud`); `expenses` MAY referenciar `supplierId`
- [x] 4.2 `usecases/liquidity.ts::payables`: gastos impagos (`paid=0`) por proveedor + aging desde `date`
- [x] 4.3 Endpoints suppliers (CRUD), `GET /payables`
- [x] 4.4 Tests: AP agrupa por proveedor; aging correcto; excluye pagados
- **Aceptación:** ✅ se ve lo que el hotel debe, por proveedor y antigüedad.

### TES-5 — Presupuesto + control de gastos  ✅ HECHO ⟵ dep: TES-0
- [x] 5.1 CRUD `budgets` (`usecases/budget.ts`, categoría + período + monto)
- [x] 5.2 `budgetVsActual`: presupuestado vs real (`expenses` por categoría/período), desviación y % ejecución (null si presupuesto 0)
- [x] 5.3 Endpoints budgets (CRUD), `GET /budget-vs-actual?period=`
- [x] 5.4 Tests: comparación correcta; señala sobre-ejecución; incluye categorías con gasto sin presupuesto
- **Aceptación:** ✅ presupuesto vs real por categoría; flag de sobre-ejecución.

### TES-6 — Frontend tesorería  ✅ HECHO ⟵ dep: TES-1..5
- [x] 6.1 `services/Treasury.service.ts` (cliente completo: liquidez, proveedores, bancos, presupuesto)
- [x] 6.2 `pages/tesoreria/dashboard.vue` (liquidez: KPIs entradas/salidas/AR/AP + tabla de flujo de caja)
- [x] 6.3 `pages/tesoreria/bancos.vue` (cuentas + import por pegado CSV + conciliación)
- [x] 6.4 `pages/tesoreria/cuentas.vue` (AR / AP con aging, tabs)
- [x] 6.5 `pages/tesoreria/presupuesto.vue` (presupuesto vs real + flag de excedido)
- [x] 6.6 4 rutas `/panel/tesoreria/*` (requiresHotelAdmin) + sección de menú + module-map (treasury)
- **Aceptación:** ✅ `vue-tsc -b` limpio; `bun run build` OK (4 chunks); menú gateado por permiso + entitlement.

---

## Fase 3 — Transversal y cierre

### CTG-1 — Permisos + entitlements + menú
- [x] 1.1 Verificado (2026-07-28): `accounting`/`treasury` en MODULES + DEFAULT_ROLE_PERMISSIONS (`permissions.ts:27,29,99,100,155,156`), hotel_admin con acceso completo.
- [x] 1.2 Verificado: claves `accounting`/`treasury` (+ submódulo `treasury.petty-cash`) en `admin/usecases/modules.ts:94-99`.
- [x] 1.3 Verificado: `/panel/contabilidad`→`accounting`, `/panel/tesoreria`→`treasury` en `frontend/src/config/module-map.ts:53-55,152-153`.
- [x] 1.4 El gateo (403 sin permiso / sin módulo del plan) usa el mismo `createPermissionGuard`+`moduleGuard` que TODOS los demás módulos del sistema — mecanismo genérico ya cubierto por la suite completa (2277 tests), no específico de contabilidad. Verificado en vivo hoy para treasury (Hotel Boutique Palma: 200 con permiso; los otros 3 hoteles necesitaron el UPDATE de `roles.permissions` que ya se aplicó).
- **Aceptación:** cumplida.

### CTG-2 — Gate final de verificación
- [x] 2.1-2.4 (reverificado 2026-07-28): `bun run tsc --noEmit` sin errores en accounting/treasury · `arckode analyze` ✅ VÁLIDO · `bun test src/modules/accounting/ src/modules/treasury/` 61/61 pass (2277/2277 en la suite completa) · `vue-tsc -b` limpio · `bun run build` ✓.
- [x] 2.5 Verificado: `recordFolioCharge` (`accounting/usecases/auto-from-events.ts:71-87`) asienta DR Clientes (total) / CR Ingresos (neto) / CR ITBIS por pagar (si aplica) al postear un cargo de folio — el asiento SIEMPRE cuadra (el neto se deriva del total, no se asume consistente). `recordPaymentCompleted` asienta DR Caja-Bancos / CR Clientes al cobrar, liquidando esa cuenta. **Hallazgo real** (no bloqueante, documentado en vez de fabricado como resuelto): una factura standalone creada vía `POST /api/facturas` SIN pasar por un folio nunca dispara un asiento de devengo (no existe conector `facturas-accounting.ts`) — solo se asienta el cobro al pagarla, lo que dejaría un crédito fantasma en Clientes sin el débito de devengo. **Verificado en prod: 0 facturas standalone existen hoy** (`SELECT count(*) FROM invoices WHERE reservationid IS NULL AND type='invoice'` → 0) — el gap es real pero sin impacto actual porque el único flujo real usado es folio→factura (`close-and-create-invoice.ts`), que sí devenga correctamente vía el folio antes de facturarse. Trackeado como deuda nueva, no arreglado en esta pasada (requeriría diseñar el conector + decidir si una factura standalone debe devengar al crearse o al emitirse).
- [x] 2.6 No se tocó `CLAUDE.md` (la sección de Facturación ya fue actualizada hoy con el estado post billing-money-consolidation) ni `PLAN-CONTABILIDAD.md` en esta pasada — fuera de alcance de la verificación puntual de hoy.

---

## Gate (bloqueante para archivar el change)

- [x] `bun run typecheck` && `bun test` (backend) — verde.
- [x] `arckode analyze` → ✅ sin violaciones.
- [x] `cd frontend && bun run typecheck` (vue-tsc -b) && `bun run build` — verde.
- [x] Todo asiento cumple `SUM(debit)=SUM(credit)` — validado en `AccountingService` (rechaza asientos desbalanceados, tests en `accounting/tests/service.test.ts`).
- [x] Test anti-doble-conteo: cubierto por `facturas/tests/stats.test.ts` ("no cuenta dos veces un cobro") — mismo invariante, verificado hoy como parte de billing-money-consolidation.
- [x] Cada endpoint tiene `auth.authenticate()` + permiso + moduleGuard — patrón genérico del framework, verificado.

El change SÍ se archiva (su propio alcance está 100% cumplido y verificado); **DT-12** (factura standalone sin devengo automático — ver 2.5) queda trackeada por separado, como deuda nueva no bloqueante, en `openspec/changes/deudas-tecnicas-pendientes/`.
