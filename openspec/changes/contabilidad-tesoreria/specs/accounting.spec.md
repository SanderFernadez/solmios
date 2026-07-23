# Spec: accounting (Contabilidad de doble entrada)

## Database changes

Nuevas tablas (ver `design.md` para el detalle de columnas): `accounts`, `journal_entries`,
`journal_lines`, `accounting_periods`. Todas con `hotelId` (multi-tenant), `id` TEXT (UUID),
`createdAt/updatedAt`, booleanos como INTEGER. DDL en inglés, vía modelos ORM (`RUN_MIGRATE`).

## API endpoints

Ver `design.md` §Endpoints/Contabilidad. Todas las rutas MUST llevar `auth.authenticate()` +
`requirePermission('accounting', <action>)` + `moduleGuard('accounting')`.

## UI requirements

Ver `design.md` §UI. Pantallas de plan de cuentas, libro diario, mayor y reportes. Texto en español.

---

## Scenarios

### R1 — Plan de cuentas jerárquico
**GIVEN** un hotel sin plan de cuentas
**WHEN** se inicializa el módulo (seed)
**THEN** el sistema MUST crear el catálogo base (§design plan de cuentas) con cuentas `postable` y de agrupación
**AND** cada cuenta MUST tener `code` único por hotel y un `type` ∈ {asset, liability, equity, income, expense}
**AND** una cuenta de agrupación (no `postable`) MUST NOT aceptar asientos directos.

### R2 — Asiento de doble entrada balanceado
**GIVEN** un asiento manual con líneas de debe y haber
**WHEN** se crea el asiento
**THEN** el sistema MUST validar `SUM(debit) = SUM(credit)` (con tolerancia de redondeo `BALANCE_EPSILON`)
**AND** MUST rechazar con `ValidationError` (400) si no cuadra
**AND** MUST rechazar líneas contra cuentas no `postable`.

### R3 — Asiento posteado es inmutable
**GIVEN** un asiento en estado `posted`
**WHEN** se intenta editarlo
**THEN** el sistema MUST rechazar la edición (409)
**AND** la única corrección permitida MUST ser una **reversión** que crea un asiento espejo (`reversalOf`) con debe/haber invertidos.

### R4 — Períodos contables
**GIVEN** un período `locked`
**WHEN** se intenta postear un asiento con `entryDate` dentro de ese período
**THEN** el sistema MUST rechazarlo (409 "período cerrado")
**AND** un período `open` MUST aceptar asientos
**AND** cerrar un período (`close`) MUST verificar que el balance de comprobación de ese período cuadra.

### R5 — Asiento automático desde cobro (idempotente)
**GIVEN** un cobro que emite `payments.onPaymentCompleted` con `paymentId=P1`, `method=cash`
**WHEN** el conector `payments-accounting` lo procesa
**THEN** el sistema MUST crear un asiento `DR 1.1.01 Caja / CR 1.1.03 Clientes` por el monto
**AND** el asiento MUST guardar `reference=P1`, `referenceType='payment'`, `source='connector'`
**AND** si el mismo evento se re-emite (mismo `paymentId`), el sistema MUST NOT duplicar el asiento (dedup por `reference`+`referenceType`)
**AND** si el módulo `accounting` no está habilitado por plan, el conector MUST ser no-op y NO romper el cobro.

### R6 — Asiento automático desde factura (devengado, con impuesto)
**GIVEN** una factura de $200 neto + 18% ITBIS = $236 emitida (`facturas.onFacturasCreated`)
**WHEN** el conector `facturas-accounting` lo procesa
**THEN** el sistema MUST crear `DR 1.1.03 Clientes 236 / CR 4.x Ingresos 200 / CR 2.1.02 ITBIS por Pagar 36`
**AND** el asiento MUST cuadrar (236 = 200 + 36)
**AND** la tasa de impuesto MUST salir de `configuration('taxes')` con fallback a `hotels.taxRate` (misma fuente que `folio-math.ts`), NO hardcodeada.

### R7 — Gasto pagado vs impago
**GIVEN** un gasto registrado
**WHEN** `paid=1` (pagado en efectivo)
**THEN** el asiento MUST ser `DR 5.x Gasto / CR 1.1.01 Caja`
**WHEN** `paid=0` (a crédito)
**THEN** el asiento MUST ser `DR 5.x Gasto / CR 2.1.01 Cuentas por Pagar`.

### R8 — Balance de comprobación cuadra
**GIVEN** cualquier conjunto de asientos posteados de un período
**WHEN** se pide el balance de comprobación
**THEN** `SUM(débitos) MUST = SUM(créditos)` en todas las cuentas
**AND** el reporte MUST listar por cuenta: saldo deudor / acreedor.

### R9 — Estado de resultados y Balance general
**GIVEN** asientos posteados de un rango de fechas
**WHEN** se pide el P&L (`/pnl?basis=accrual|cash`)
**THEN** el sistema MUST devolver Ingresos (grupo 4) − Costos/Gastos (grupo 5) = Resultado
**AND** en base `cash` MUST calcular desde movimientos de Caja/Bancos (no devengado)
**WHEN** se pide el Balance General (`/balance-sheet?period=`)
**THEN** MUST cumplir `Activo = Pasivo + Patrimonio` (incluyendo el resultado del ejercicio).

### R10 — Anti-doble-conteo (invariante crítica)
**GIVEN** una factura de $100 emitida y luego cobrada $100
**WHEN** se computa el ingreso del período
**THEN** el ingreso (cuenta 4.x) MUST ser $100, NO $200
**AND** el cobro MUST saldar Clientes contra Caja, sin re-asentar ingreso
**AND** un test MUST verificar que emitir + cobrar la misma factura no duplica el ingreso (hereda el caso #333).
