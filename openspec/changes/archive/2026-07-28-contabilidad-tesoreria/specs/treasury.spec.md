# Spec: treasury (Tesorería)

## Database changes

Nuevas tablas: `bank_accounts`, `bank_movements`, `suppliers`, `budgets` (ver `design.md`). AR y AP
**no tienen tabla propia**: se derivan de `folio_charges`/`invoices` (AR) y `expenses` (AP). Todas con
`hotelId`, `id` TEXT (UUID), `createdAt`. DDL en inglés vía ORM.

## API endpoints

Ver `design.md` §Endpoints/Tesorería. Todas MUST llevar `auth.authenticate()` +
`requirePermission('treasury', <action>)` + `moduleGuard('treasury')`.

## UI requirements

Ver `design.md` §UI: dashboard de liquidez, bancos+conciliación, AR/AP aging, presupuesto. Español.

---

## Scenarios

### T1 — Cuentas bancarias
**GIVEN** un hotel
**WHEN** se crea una cuenta bancaria con `openingBalance`
**THEN** el sistema MUST registrarla con `currentBalance = openingBalance`
**AND** MAY vincularla a una cuenta contable `1.1.02 Bancos` (`accountId`)
**AND** toda query MUST filtrar por `hotelId`.

### T2 — Import de movimientos bancarios (CSV)
**GIVEN** una cuenta bancaria y un archivo CSV de movimientos (fecha, descripción, monto)
**WHEN** se importa
**THEN** el sistema MUST crear filas en `bank_movements` con `reconciled=0`
**AND** MUST NOT duplicar un movimiento ya importado (dedup por `bankAccountId`+`date`+`amount`+`reference`).

### T3 — Conciliación bancaria
**GIVEN** movimientos bancarios sin conciliar y pagos en `payments`
**WHEN** se corre la conciliación
**THEN** el sistema MUST proponer matches por monto+fecha (± tolerancia) entre `bank_movements` y `payments`
**AND** al confirmar un match MUST marcar `bank_movements.reconciled=1` y guardar `paymentId`
**AND** MUST reportar movimientos sin match (diferencias) para revisión
**AND** MUST reutilizar la lógica existente de `payments.reconcile()` donde aplique.

### T4 — Flujo de caja (cash flow)
**GIVEN** cobros (`payments type=charge`) y pagos (`expenses paid=1`) en un rango
**WHEN** se pide el flujo de caja (`/cash-flow?from=&to=`)
**THEN** el sistema MUST devolver entradas − salidas agrupadas por período (día/semana/mes)
**AND** MUST calcular el saldo acumulado de liquidez
**AND** MUST excluir depósitos de garantía de las entradas de ingreso (son pasivo, igual que `reports/money.ts`).

### T5 — Cuentas por cobrar (AR) con aging
**GIVEN** facturas/folios con saldo pendiente (`amount − amountPaid > 0`)
**WHEN** se pide AR con aging (`/receivables?aging=1`)
**THEN** el sistema MUST listar por huésped/empresa el saldo pendiente
**AND** MUST clasificar por antigüedad: corriente, 1-30, 31-60, 61-90, +90 días (desde `dueDate`/`issueDate`)
**AND** el total de AR MUST = devengado − cobrado (consistente con `reports/strategies/facturacion.ts`).

### T6 — Cuentas por pagar (AP) con aging
**GIVEN** gastos impagos (`expenses.paid=0`)
**WHEN** se pide AP con aging (`/payables?aging=1`)
**THEN** el sistema MUST listar por proveedor (`provider`/`supplierId`) el monto adeudado
**AND** MUST clasificar por antigüedad desde `expenses.date`
**AND** MAY vincular cada gasto a un `supplier` para agrupar.

### T7 — Proveedores
**GIVEN** el hotel gestiona proveedores
**WHEN** se crea/edita un proveedor
**THEN** el sistema MUST guardarlo con `hotelId`, `name`, `taxId` opcional
**AND** un gasto MAY referenciar un `supplierId` para el aging de AP.

### T8 — Presupuesto y control
**GIVEN** un presupuesto por categoría y período (`budgets`)
**WHEN** se pide presupuesto vs real (`/budget-vs-actual?period=`)
**THEN** el sistema MUST comparar `budgetedAmount` contra el total real de `expenses` de esa categoría/período
**AND** MUST calcular la desviación (real − presupuestado) y el % de ejecución
**AND** MUST señalar las categorías sobre-ejecutadas (real > presupuesto).

### T9 — Entitlement y permisos
**GIVEN** un hotel cuyo plan NO incluye el módulo `treasury`
**WHEN** un usuario llama cualquier endpoint `/api/treasury/*`
**THEN** el sistema MUST responder 403 "Módulo no disponible en tu plan: treasury"
**AND** un usuario sin permiso `treasury:view` MUST recibir 403 aunque el plan lo incluya.
