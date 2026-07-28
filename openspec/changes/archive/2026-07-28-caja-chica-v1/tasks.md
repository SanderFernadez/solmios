# caja-chica — Tasks

**v1 completa (2026-07-28)**. El backend (bloques 1-5) ya estaba implementado y commiteado desde
antes de esta sesión, con 18 tests propios (más 8 de `gastos` afectados) — pero `tasks.md` nunca se
marcó `[x]`, quedando desalineado con la realidad (mismo patrón encontrado en `carta-experiencia-avanzada`).
El frontend (6.1/6.2) estaba bloqueado por un working tree compartido con `PLAN-REFERIDOS` en
`router/index.ts`/`AdminLayout.vue` — verificado que ese conflicto ya no existe (ambos archivos
limpios salvo el propio diff de esta sesión) y se implementó: `pages/tesoreria/caja-chica.vue` +
`services/CajaChica.service.ts`, ruta `/panel/tesoreria/caja-chica`, entrada de menú bajo Tesorería.
Gate 7 corrido y verde: `arckode analyze` 0 violaciones, `bun test caja-chica+gastos` 26/26,
typecheck backend sin errores nuevos, typecheck+build frontend limpios. Probado en vivo en el
navegador: crear fondo → reponer (saldo $0→$5000) → eliminar, todo funcionando end-to-end.

## v1 — core seguro (sin dinero real)

### 1. Módulo caja-chica (`backend/src/modules/caja-chica/`)
- [x] 1.1 `model.ts` — `PettyCashFundsModel` (id, hotelId, name, custodianId, targetAmount, currentBalance, currency, active, notes) + `PettyCashReplenishmentModel` (id, hotelId, fundId, amount, status: requested/completed/cancelled, requestedBy, approvedBy, sourceBankAccountId, notes). `registerCajaChicaModels(orm)`.
- [x] 1.2 `types.ts` — FundDTO, ReplenishmentDTO, Create*/Update*, CurrentUser.
- [x] 1.3 `service.ts` — `CajaChicaService`: CRUD fondos, `replenish()` (requested→completed + bump currentBalance), recalcular saldo. Inyecta `OrmRepository<T>` (NO orm directo).
- [x] 1.4 `usecases/funds-crud.ts` — clonado de `treasury/usecases/suppliers-crud.ts` (hotelId forzado, assertOwnership).
- [x] 1.5 `usecases/replenish.ts` — workflow requested→completed, bump currentBalance.
- [x] 1.6 `controller.ts` — HTTP adapter, `validateSchema` en cada POST/PUT.
- [x] 1.7 `index.ts` — `createModule('caja-chica')`, guard reusando `treasury` (`[...permGuard('treasury',a), moduleGuard('treasury')]`), rutas `/api/petty-cash/funds*` y `/api/petty-cash/replenishments*`. APPEND-ONLY.
- [x] 1.8 `validators/schema.ts` — CreateFund/UpdateFund/CreateReplenishment.
- [x] 1.9 `sockets.ts` — onFundCreated/Updated/Deleted.
- [x] 1.10 `tests/service.test.ts` — saldo tras gasto, tras reposición, ownership, IDOR.

### 2. Vínculo con gastos
- [x] 2.1 `modules/gastos/model.ts` (+`pettyCashFundId: { type:'string', indexed:true }`).
- [x] 2.2 `modules/gastos/types.ts` (+`pettyCashFundId?` en GastosDTO y CreateGastosDTO).
- [x] 2.3 `modules/gastos/validators/schema.ts` (+`pettyCashFundId` en CreateGastosSchema, NO en update).

### 3. Conector caja-chica-gastos
- [x] 3.1 `connectors/caja-chica-gastos.ts` — reacciona a sockets de gastos (create/update/delete); si el gasto tiene `pettyCashFundId`, descuenta/reverte `fund.currentBalance`. Idempotente, best-effort.

### 4. Wiring
- [x] 4.1 `composition-root.ts` — importar y agregar `CajaChicaModule()` al array `mods`; cablear `cajaChicaGastosConnector(ctx)`.
- [x] 4.2 `admin/usecases/modules.ts` — agregar `submodules: [{ key:'treasury.petty-cash', label:'Caja chica' }]` bajo `treasury`.

### 5. Migración prod
- [x] 5.1 RUN_MIGRATE crea las 2 tablas (CREATE TABLE IF NOT EXISTS vía modelos). ADD COLUMN `pettyCashFundId` en expenses.
- [x] 5.2 Habilitar submódulo `treasury.petty-cash` en `plans.modules` (SQL puntual, ver patrón de habilitar módulos).

### 6. Frontend (cuando working tree de PLAN-REFERIDOS sincronice)
- [x] 6.1 Página `/panel/tesoreria/caja-chica` — lista de fondos + saldo + reposiciones.
- [x] 6.2 Ruta + menú (child de Tesorería). **Bloqueado por PLAN-REFERIDOS** (working tree compartido en router/AdminLayout).

### 7. Gate
- [x] 7.1 `arckode analyze` 0 violaciones.
- [x] 7.2 `bun test` (caja-chica + gastos).
- [x] 7.3 typecheck backend.
- [x] 7.4 e2e: crear fondo → gasto del fondo (saldo baja) → reposición (saldo al tope).

## v2 — dinero real (después)
- [ ] Conector caja-chica-treasury: reposición completed → restar bank_accounts.currentBalance + bank_movement.
- [ ] Conector caja-chica-accounting: asiento traslado banco→caja chica.
- [ ] Estado `approved` (workflow con roles).
- [ ] Reportes (consumo por categoría/custodio/mes), alertas fondo bajo.
- [ ] Módulo `petty_cash` propio (custodios supervisores sin treasury completo).
