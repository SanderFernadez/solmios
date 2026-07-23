# Design: contabilidad-tesoreria

## Decisiones de arquitectura

| Decisión | Elección | Rationale |
|----------|----------|-----------|
| Motor contable | **In-house** en `arckode-framework` | Control total, integración directa por conectores, sin dependencia de ERP externo. Decidido por el dueño. |
| Módulos | 2 nuevos: `accounting` + `treasury` | Separar el libro contable (asientos/estados) de la gestión de liquidez (bancos/AR/AP/presupuesto). |
| Integración | Conectores reactivos a eventos | Los módulos origen no se modifican; el patrón ya es el estándar del repo. |
| Fuente de datos | `payments` (cobrado), `expenses` (pagado), `invoices`/`folio_charges` (devengado) | No mezclar magnitudes — evita el doble conteo histórico. |
| Base contable | **Devengado** para estados, con vista **caja** disponible | Un asiento por devengado (factura) + asiento por cobro (payment). El P&L puede darse en ambas bases. |
| Idempotencia | `journal_entries.reference` + `referenceType` únicos por origen | Un evento re-emitido no duplica el asiento. |
| Moneda | Única por hotel (de `hotels.currency`) | Igual que el resto del sistema; multi-moneda queda fuera de scope. |

## Modelo de datos (nuevas tablas — DB en inglés)

### Contabilidad (`accounting`)

```
accounts                 -- Plan de cuentas (chart of accounts)
  id, hotelId, code, name, type(asset|liability|equity|income|expense),
  parentId, isPostable(1/0), active, createdAt, updatedAt
  UNIQUE(hotelId, code)

journal_entries          -- Asientos (cabecera)
  id, hotelId, entryDate, description, reference, referenceType(invoice|payment|expense|deposit|folio|cash_shift|manual|adjustment),
  period(YYYY-MM), status(draft|posted|reversed), reversalOf, source(manual|connector),
  createdBy, createdAt, postedAt
  INDEX(hotelId, period), INDEX(reference, referenceType)

journal_lines            -- Líneas del asiento (doble entrada)
  id, entryId, hotelId, accountId, debit(default 0), credit(default 0), description
  INDEX(entryId), INDEX(accountId)
  -- Invariante: SUM(debit) = SUM(credit) por entryId

accounting_periods       -- Períodos contables mensuales
  id, hotelId, period(YYYY-MM), startDate, endDate, status(open|closed|locked), closedBy, closedAt
  UNIQUE(hotelId, period)
```

### Tesorería (`treasury`)

```
bank_accounts            -- Cuentas bancarias del hotel
  id, hotelId, name, bank, accountNumber, currency, type(checking|savings|cash),
  openingBalance, currentBalance, accountId(FK a accounts, opcional), active, createdAt

bank_movements           -- Movimientos bancarios (import manual/CSV para conciliar)
  id, hotelId, bankAccountId, date, description, amount(+entrada/-salida), reference,
  reconciled(1/0), paymentId(match con payments), createdAt
  INDEX(hotelId, bankAccountId), INDEX(reconciled)

suppliers                -- Proveedores (para AP)
  id, hotelId, name, taxId, contact, email, phone, active, createdAt

budgets                  -- Presupuesto por categoría/período
  id, hotelId, period(YYYY-MM), category, budgetedAmount, notes, createdAt
  UNIQUE(hotelId, period, category)
```

> **AR y AP no tienen tabla propia**: se **derivan** de datos existentes.
> - **AR (cuentas por cobrar)** = por reserva/huésped: `SUM(folio_charges devengado) − SUM(payments del folio)`
>   (o `invoices.amount − invoices.amountPaid` para facturas emitidas). Aging por `dueDate`/`issueDate`.
> - **AP (cuentas por pagar)** = `expenses` con `paid=0`, agrupadas por `provider`/`supplierId`. Aging por `date`.

## Plan de cuentas base (seed — DGII/RD aware, editable por el contador)

```
1  ACTIVO
  1.1  Activo Corriente
    1.1.01  Caja (efectivo en caja)                    [postable]
    1.1.02  Bancos                                      [postable]  ← por cada bank_account
    1.1.03  Cuentas por Cobrar Clientes (AR)            [postable]
    1.1.04  ITBIS Adelantado / crédito fiscal           [postable]
1.2  Activo Fijo
2  PASIVO
  2.1  Pasivo Corriente
    2.1.01  Cuentas por Pagar Proveedores (AP)          [postable]
    2.1.02  ITBIS por Pagar (impuesto sobre ventas)     [postable]
    2.1.03  Depósitos de Huéspedes (garantías)          [postable]  ← liability, no ingreso
    2.1.04  Ingresos Diferidos (reservas prepagadas)    [postable]
3  PATRIMONIO
    3.1.01  Capital
    3.2.01  Resultados Acumulados
4  INGRESOS
    4.1.01  Ingresos por Habitación                     [postable]
    4.2.01  Ingresos por Servicios / Extras             [postable]
    4.3.01  Otros Ingresos                              [postable]
5  COSTOS Y GASTOS
    5.1.01  Costos Operativos                           [postable]
    5.2.01  Nómina                                      [postable]  ← desde payroll-gastos
    5.3.01  Gastos Administrativos                      [postable]
    5.4.01  Servicios (agua, luz, internet)             [postable]
    5.5.01  Devoluciones y Notas de Crédito             [postable]
```

## Mapeo evento → asiento (doble entrada)

Cada conector escucha un evento existente y genera un asiento. `DR`=debe, `CR`=haber.

| Evento (origen) | Base | Asiento |
|-----------------|------|---------|
| `facturas.onFacturasCreated` | devengado | **DR** 1.1.03 Clientes (total) · **CR** 4.x Ingresos (neto) · **CR** 2.1.02 ITBIS por Pagar (impuesto) |
| `folios.onFolioCharged` (night audit) | devengado | **DR** 1.1.03 Clientes · **CR** 4.1 Ingresos por Habitación |
| `payments.onPaymentCompleted` (`type=charge`) | caja | **DR** 1.1.01 Caja / 1.1.02 Bancos (según `method`) · **CR** 1.1.03 Clientes |
| `payments.onRefundProcessed` (`type=refund`) | caja | **DR** 1.1.03 Clientes (o 5.5.01 Devoluciones) · **CR** 1.1.01/1.1.02 |
| `payments.onDepositCreated` (`type=deposit`) | caja | **DR** 1.1.02 Bancos · **CR** 2.1.03 Depósitos de Huéspedes |
| `payments.onDepositReleased` | caja | **DR** 2.1.03 Depósitos · **CR** 1.1.02 (devolución) o **CR** 4.x (si se aplica a consumo) |
| `gastos.onGastosCreated` (`paid=1`) | caja | **DR** 5.x Gasto (por categoría) · **CR** 1.1.01/1.1.02 (según `paymentMethod`) |
| `gastos.onGastosCreated` (`paid=0`) | devengado | **DR** 5.x Gasto · **CR** 2.1.01 Cuentas por Pagar |
| `facturas` nota de crédito | devengado | **DR** 5.5.01 Devoluciones (+ **DR** 2.1.02 ITBIS) · **CR** 1.1.03 Clientes |

> **Regla anti-doble-conteo**: la factura (devengado) asienta contra Clientes; el cobro (caja) **salda**
> Clientes contra Caja/Bancos. Nunca se asienta ingreso dos veces. El P&L base devengado suma la cuenta
> 4.x; el P&L base caja se deriva de los movimientos de Caja/Bancos.

## Flujo (sequence) — cobro de una factura

```
Huésped paga factura
  → facturas.pay()  [existente, sin cambios]
     → payment-port → payments.createPayment(type=charge, status=completed)  [existente]
        → emite payments.onPaymentCompleted
           ├─→ connector payments-caja        [existente]  → cash_movements (si method=cash)
           └─→ connector payments-accounting   [NUEVO]      → journal_entry:
                   DR 1.1.01 Caja / CR 1.1.03 Clientes
                   reference=paymentId, referenceType='payment'  (idempotente)
```

Si el asiento ya existe para ese `paymentId`, el conector **no hace nada** (dedup). Si el módulo
`accounting` no está habilitado por plan, el conector es no-op (fail-open, no rompe el cobro).

## Endpoints (API — todas con `auth.authenticate()` + permiso + entitlement)

### Contabilidad
```
GET   /api/accounting/accounts                 accounting:view    Plan de cuentas
POST  /api/accounting/accounts                 accounting:create
PUT   /api/accounting/accounts/:id             accounting:edit
GET   /api/accounting/journal?period=YYYY-MM   accounting:view    Libro diario
POST  /api/accounting/journal                  accounting:create  Asiento manual
POST  /api/accounting/journal/:id/post         accounting:edit
POST  /api/accounting/journal/:id/reverse      accounting:edit
GET   /api/accounting/ledger?account=X         accounting:view    Mayor de cuenta
GET   /api/accounting/trial-balance?period=    accounting:view    Balance comprobación
GET   /api/accounting/pnl?from=&to=&basis=     accounting:view    Estado de resultados
GET   /api/accounting/balance-sheet?period=    accounting:view    Balance general
GET   /api/accounting/periods                  accounting:view
POST  /api/accounting/periods/:id/close        accounting:edit
```

### Tesorería
```
GET/POST/PUT  /api/treasury/bank-accounts           treasury:view/create/edit
POST  /api/treasury/bank-accounts/:id/import        treasury:edit    Import CSV movimientos
POST  /api/treasury/reconcile                       treasury:edit    Conciliación bancaria
GET   /api/treasury/cash-flow?from=&to=             treasury:view    Flujo de caja
GET   /api/treasury/receivables?aging=1             treasury:view    AR con aging
GET   /api/treasury/payables?aging=1                treasury:view    AP con aging
GET/POST/PUT  /api/treasury/suppliers               treasury:view/create/edit
GET/POST/PUT  /api/treasury/budgets                 treasury:view/create/edit
GET   /api/treasury/budget-vs-actual?period=        treasury:view    Presupuesto vs real
```

## UI (frontend — texto en español, `<script setup lang="ts">` + `<style scoped>`)

- `pages/contabilidad/plan-cuentas.vue` — árbol del plan de cuentas (CRUD).
- `pages/contabilidad/libro-diario.vue` — asientos por período + alta de asiento manual.
- `pages/contabilidad/mayor.vue` — libro mayor por cuenta.
- `pages/contabilidad/reportes.vue` — tabs: Balance de comprobación, Estado de resultados, Balance general.
- `pages/tesoreria/dashboard.vue` — liquidez + flujo de caja (gráfico).
- `pages/tesoreria/bancos.vue` — cuentas bancarias + conciliación (import CSV, match).
- `pages/tesoreria/cuentas.vue` — AR y AP con aging (tabs).
- `pages/tesoreria/presupuesto.vue` — presupuesto vs real por categoría.
- Menú (`AdminLayout`): sección **Contabilidad** y **Tesorería** (gateadas por permiso + entitlement).

## Reglas contables (invariantes)

1. **Doble entrada**: todo asiento cumple `SUM(debit) = SUM(credit)`; se rechaza si no cuadra.
2. **Asiento posteado inmutable**: solo se corrige con una **reversión** (`reversalOf`), nunca editando.
3. **Período**: los asientos caen en el período `YYYY-MM` de su `entryDate`; un período `locked` rechaza asientos nuevos.
4. **Integración solo por conector**: nunca import directo entre módulos.
5. **Idempotencia**: `(reference, referenceType)` único por asiento automático.
6. **Moneda**: la del hotel (`hotels.currency`); sin conversión en asientos.
7. **Multi-tenant**: toda query filtra por `hotelId`.
