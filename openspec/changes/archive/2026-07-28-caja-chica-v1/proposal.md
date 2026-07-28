# caja-chica

## Intent

**Caja chica (petty cash)**: fondo fijo con tope y **custodio** (users.id) para **gastos menores/imprevistos** (mandados, remedios, taxista). Se gasta del fondo (saldo baja) y se **repone** al tope cuando se agota. Hoy **no existe** — el módulo `cash` actual es turnos POS (cobrar ventas del día), concepto distinto.

## Contexto (verificado 2026-07-25)

- `modules/cash/` = turnos POS (`cash_shifts` + `cash_movements`, `register` reception/restaurant). No es petty cash.
- `grep "petty|cajaChica|fondoFijo"` en `backend/src/` = **0 hits**. No existe.
- `modules/gastos/` ya implementa el patrón "origen externo" con `source` + `sourceId` (`upsertBySource`, usado por payroll y purchase_orders). Un gasto de caja chica vive en `expenses` con `source:'petty_cash'` + `pettyCashFundId` — así no se fuga del AP ni de la contabilidad.

## Decisión (2026-07-25)

Feature nueva. v1 implementa el **core seguro** (gestión del fondo + saldo + vínculo con gastos) **sin movimiento de dinero real** (la reposición se completa a mano). v2 integra el banco y la contabilidad.

## Scope (v1)

- **Fondos** (`petty_cash_funds`): CRUD con `custodianId` (users.id), `targetAmount` (tope), `currentBalance` (persistido), `currency`, `active`.
- **Saldo persistido** (como `bank_accounts.currentBalance`): recalcular en cada mutación.
- **Gasto de caja chica**: `expenses.pettyCashFundId` + conector `caja-chica-gastos` que descuenta `currentBalance` al crear gasto y revierte al editar/borrar (simétrico a `gastos-caja`).
- **Reposición simplificada** (`petty_cash_replenishments`): `requested → completed` (admin la completa a mano). `completed` bumpa `currentBalance` al tope. **Sin tocar banco** en v1.
- **Permisos**: submódulo `treasury.petty-cash` (reusa guard de `treasury`). No tocar `permissions.ts`.
- Reglas: `validateSchema` en mutaciones, `hotelId` del JWT (IDOR), `assertOwnership`, `custodianId` resuelto contra `users.id`.

## Out of scope (v2)

- Estado `approved` intermedio (workflow request→approve→complete con roles).
- Conector `caja-chica-treasury`: al `completed`, restar `bank_accounts.currentBalance` + generar `bank_movement` (debit, para conciliación).
- Asiento contable `caja-chica-accounting` (reposición = traslado banco→caja chica).
- Reportes de caja chica (consumo por categoría/custodio/mes), topes por categoría, alertas de fondo bajo.
- Módulo `petty_cash` propio (para dar acceso de custodio a supervisores sin `treasury` completo).

## Riesgos

- `custodianId` debe resolver contra `users.id` (NO `employee-profiles` — ver regla del proyecto).
- El saldo persistido puede desincronizarse si un gasto se crea fuera del conector (escapar); mitigar validando `pettyCashFundId` solo vía el conector `upsertBySource`.
- v1 NO mueve dinero real: la "reposición" es lógica hasta v2. Documentarlo en UI.
