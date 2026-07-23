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
- [ ] 1.3 Seed del catálogo base hotelero (design.md §plan de cuentas) — script idempotente por hotel
- [x] 1.4 Validación: `code` único por hotel; no borrar cuenta con hijos ni con asientos (integridad referencial)
- [ ] 1.5 Tests: seed crea el catálogo; cuenta de agrupación rechaza asiento directo (los tests de CRUD/dup/IDOR/integridad ✅)
- **Aceptación:** un hotel nuevo obtiene el plan base; el catálogo es editable; tests verdes.

### CTB-2 — Asientos manuales + doble entrada + post/reverse  ⟵ dep: CTB-1
- [ ] 2.1 `usecases/journal-entry.ts`: crear asiento con líneas debe/haber, validar `SUM(debit)=SUM(credit)`
- [ ] 2.2 Rechazar líneas contra cuentas no-postable; rechazar descuadre (`ValidationError`)
- [ ] 2.3 `post` (draft→posted) y `reverse` (crea asiento espejo `reversalOf`); posteado inmutable (409 en edit)
- [ ] 2.4 Endpoints `POST /journal`, `/journal/:id/post`, `/journal/:id/reverse`, `GET /journal?period=`
- [ ] 2.5 Tests: asiento balanceado OK; descuadre rechazado; edición de posteado rechazada; reversión invierte debe/haber
- **Aceptación:** se puede asentar a mano, postear y revertir; nunca queda un asiento descuadrado.

### CTB-3 — Períodos contables (open/close/lock)  ⟵ dep: CTB-2
- [ ] 3.1 `usecases/period.ts`: abrir período `YYYY-MM`, cerrar (valida trial balance cuadra), lock
- [ ] 3.2 Al postear, resolver el período por `entryDate`; rechazar si `locked` (409)
- [ ] 3.3 Endpoints `GET /periods`, `POST /periods/:id/close`
- [ ] 3.4 Tests: asiento en período locked rechazado; cierre valida cuadre
- **Aceptación:** los asientos caen en su período; un período cerrado no acepta más asientos.

### CTB-4 — Asientos automáticos (conectores desde eventos)  ⟵ dep: CTB-2
- [ ] 4.1 `connectors/payments-accounting.ts`: `onPaymentCompleted`/`onRefundProcessed`/deposit → asiento (design.md §mapeo), dedup por `reference`
- [ ] 4.2 `connectors/facturas-accounting.ts`: `onFacturasCreated` → DR Clientes / CR Ingresos + ITBIS (tasa de config, no hardcode)
- [ ] 4.3 `connectors/gastos-accounting.ts`: `onGastosCreated` → gasto pagado (Caja) vs impago (AP)
- [ ] 4.4 `connectors/folios-accounting.ts`: `onFolioCharged` (night audit) → DR Clientes / CR Ingresos habitación
- [ ] 4.5 `connectors/cash-accounting.ts`: `onShiftClosed` → asiento de diferencia de arqueo (si la hay)
- [ ] 4.6 Todos: no-op si `accounting` no está habilitado por plan; best-effort (no rompe el origen); idempotentes
- [ ] 4.7 Registrar los 5 conectores en `composition-root.ts`
- [ ] 4.8 Tests: cada evento genera el asiento correcto y cuadrado; re-emisión no duplica; módulo apagado = no-op
- **Aceptación:** operar el hotel (cobrar, facturar, gastar) genera los asientos solo; cero doble conteo.

### CTB-5 — Libro mayor + balance de comprobación  ⟵ dep: CTB-4
- [ ] 5.1 `usecases/general-ledger.ts`: mayor por cuenta (movimientos + saldo corriente)
- [ ] 5.2 `usecases/trial-balance.ts`: saldos deudor/acreedor por cuenta; verifica `SUM(débitos)=SUM(créditos)`
- [ ] 5.3 Endpoints `GET /ledger?account=`, `GET /trial-balance?period=`
- [ ] 5.4 Tests: mayor suma correcto; trial balance cuadra sobre asientos de prueba
- **Aceptación:** el balance de comprobación siempre cuadra; el mayor refleja los asientos.

### CTB-6 — Estados financieros (P&L + Balance general)  ⟵ dep: CTB-5
- [ ] 6.1 `usecases/profit-loss.ts`: Ingresos(4) − Gastos(5) = Resultado, base `accrual` y `cash`
- [ ] 6.2 `usecases/balance-sheet.ts`: Activo = Pasivo + Patrimonio (incluye resultado del ejercicio)
- [ ] 6.3 Endpoints `GET /pnl?from=&to=&basis=`, `GET /balance-sheet?period=`
- [ ] 6.4 Tests anti-doble-conteo (R10): emitir+cobrar la misma factura no duplica ingreso; balance cuadra
- **Aceptación:** P&L y Balance general correctos y cuadrados; test anti-doble-conteo verde.

### CTB-7 — Frontend contabilidad  ⟵ dep: CTB-6
- [ ] 7.1 `services/Accounting.service.ts` + tipos en `types/index.ts`
- [ ] 7.2 `pages/contabilidad/plan-cuentas.vue` (árbol CRUD)
- [ ] 7.3 `pages/contabilidad/libro-diario.vue` (asientos por período + alta manual)
- [ ] 7.4 `pages/contabilidad/mayor.vue`
- [ ] 7.5 `pages/contabilidad/reportes.vue` (tabs: comprobación, P&L, balance general)
- [ ] 7.6 Rutas + entradas de menú (sección Contabilidad) gateadas por permiso + entitlement
- **Aceptación:** `vue-tsc -b` limpio; las 4 pantallas cargan datos reales; menú gateado.

---

## Fase 2 — Tesorería

### TES-0 — Módulo `treasury` base + schema + wiring
- [ ] 0.1 `make:module Treasury` + modelos `bank_accounts`, `bank_movements`, `suppliers`, `budgets`
- [ ] 0.2 Registrar en `composition-root.ts`; permisos `treasury:*`; clave de catálogo `treasury`
- [ ] 0.3 `RUN_MIGRATE` crea las tablas (SQLite + PG)
- **Aceptación:** `arckode analyze` 0 violaciones; tablas creadas; módulo arranca.

### TES-1 — Cuentas bancarias + movimientos + conciliación  ⟵ dep: TES-0
- [ ] 1.1 CRUD `bank_accounts` (opcional vínculo a cuenta contable `1.1.02`)
- [ ] 1.2 Import CSV de `bank_movements` (dedup por cuenta+fecha+monto+ref)
- [ ] 1.3 `usecases/reconcile.ts`: match `bank_movements` ↔ `payments` por monto+fecha; reutiliza `payments.reconcile()`
- [ ] 1.4 Endpoints bank-accounts (CRUD), `/import`, `/reconcile`
- [ ] 1.5 Tests: import idempotente; match marca `reconciled=1`; diferencias reportadas
- **Aceptación:** se importan movimientos y se concilian contra pagos; las diferencias quedan visibles.

### TES-2 — Flujo de caja (cash flow)  ⟵ dep: TES-0
- [ ] 2.1 `usecases/cash-flow.ts`: entradas (`payments charge`) − salidas (`expenses paid`) por período; excluye depósitos garantía
- [ ] 2.2 Saldo acumulado de liquidez; agrupación día/semana/mes
- [ ] 2.3 Endpoint `GET /cash-flow?from=&to=&group=`
- [ ] 2.4 Tests: entradas/salidas correctas; depósitos excluidos; acumulado consistente con `reports/money.ts`
- **Aceptación:** el flujo de caja refleja el dinero real sin doble conteo.

### TES-3 — Cuentas por cobrar (AR) con aging  ⟵ dep: TES-0
- [ ] 3.1 `usecases/receivables.ts`: saldo pendiente por huésped/empresa (devengado − cobrado)
- [ ] 3.2 Aging: corriente, 1-30, 31-60, 61-90, +90 (desde `dueDate`/`issueDate`)
- [ ] 3.3 Endpoint `GET /receivables?aging=1`
- [ ] 3.4 Tests: total AR = devengado − cobrado (consistente con `reports/strategies/facturacion.ts`); buckets correctos
- **Aceptación:** AR consistente con reportes; aging correcto.

### TES-4 — Cuentas por pagar (AP) + proveedores  ⟵ dep: TES-0
- [ ] 4.1 CRUD `suppliers`; `expenses` MAY referenciar `supplierId`
- [ ] 4.2 `usecases/payables.ts`: gastos impagos (`paid=0`) por proveedor + aging desde `date`
- [ ] 4.3 Endpoints suppliers (CRUD), `GET /payables?aging=1`
- [ ] 4.4 Tests: AP agrupa por proveedor; aging correcto
- **Aceptación:** se ve lo que el hotel debe, por proveedor y antigüedad.

### TES-5 — Presupuesto + control de gastos  ⟵ dep: TES-0
- [ ] 5.1 CRUD `budgets` (categoría + período + monto)
- [ ] 5.2 `usecases/budget-vs-actual.ts`: presupuestado vs real (`expenses` por categoría/período), desviación y % ejecución
- [ ] 5.3 Endpoints budgets (CRUD), `GET /budget-vs-actual?period=`
- [ ] 5.4 Tests: comparación correcta; señala sobre-ejecución
- **Aceptación:** presupuesto vs real por categoría; alerta de sobre-ejecución.

### TES-6 — Frontend tesorería  ⟵ dep: TES-1..5
- [ ] 6.1 `services/Treasury.service.ts` + tipos
- [ ] 6.2 `pages/tesoreria/dashboard.vue` (liquidez + gráfico de flujo de caja)
- [ ] 6.3 `pages/tesoreria/bancos.vue` (cuentas + import CSV + conciliación)
- [ ] 6.4 `pages/tesoreria/cuentas.vue` (AR / AP con aging, tabs)
- [ ] 6.5 `pages/tesoreria/presupuesto.vue` (presupuesto vs real)
- [ ] 6.6 Rutas + menú (sección Tesorería) gateadas por permiso + entitlement
- **Aceptación:** `vue-tsc -b` limpio; pantallas con datos reales; menú gateado.

---

## Fase 3 — Transversal y cierre

### CTG-1 — Permisos + entitlements + menú
- [ ] 1.1 `shared/permissions.ts`: `accounting` y `treasury` en MODULES; hotel_admin con acceso completo
- [ ] 1.2 `admin/usecases/modules.ts`: claves `accounting`, `treasury` en el catálogo (submódulos si aplica)
- [ ] 1.3 `frontend/src/config/module-map.ts`: `ROUTE_TO_KEY` + `ROUTE_TO_PERMISSION` para las rutas nuevas
- [ ] 1.4 Verificar gateo: rol sin permiso → 403; plan sin módulo → 403 "no disponible en tu plan"
- **Aceptación:** las nuevas secciones respetan permisos granulares y entitlement de plan (consistente con #428).

### CTG-2 — Gate final de verificación
- [ ] 2.1 `bun run typecheck` (backend) sin errores nuevos
- [ ] 2.2 `arckode analyze` → ✅ 0 violaciones
- [ ] 2.3 `bun test` (backend) verde, incluyendo tests anti-doble-conteo
- [ ] 2.4 `cd frontend && bun run typecheck` (vue-tsc -b) + `bun run build` OK
- [ ] 2.5 E2E: cobro → asiento cuadrado; factura → asiento con ITBIS; balance de comprobación cuadra; P&L base caja == flujo de caja del período
- [ ] 2.6 Actualizar `CLAUDE.md` (sección Módulos + Finance) y `PLAN-CONTABILIDAD.md` (marcar implementado)
- **Aceptación:** todos los gates verdes; documentación actualizada.

---

## Gate (bloqueante para archivar el change)

- [ ] `bun run typecheck` && `bun test` (backend)
- [ ] `arckode analyze` → ✅ sin violaciones
- [ ] `cd frontend && bun run typecheck` (vue-tsc -b) && `bun run build`
- [ ] Todo asiento cumple `SUM(debit)=SUM(credit)`; balance de comprobación cuadra
- [ ] Test anti-doble-conteo: emitir + cobrar la misma factura no duplica ingreso
- [ ] Cada endpoint tiene `auth.authenticate()` + permiso + moduleGuard
