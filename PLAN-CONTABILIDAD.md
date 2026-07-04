# Plan de Contabilidad Completa — Manager Hotel (SOLMI OS)

> ⚠️ **DOCUMENTO DE PLANIFICACIÓN — NO IMPLEMENTADO**
> 
> Este documento describe qué se necesitaría para agregar contabilidad completa
> (doble entrada, P&L, balance sheet) al PMS. **No está implementado ni en desarrollo.**
> Primero hay que asegurar que el flujo financiero simple (folio → factura → pago)
> funciona sólido en producción.

---

## ¿Hace falta contabilidad completa?

Para un hotel **pequeño-mediano**, la contabilidad simple actual es suficiente:
- Cada checkout genera factura
- Las facturas son rastreables por fecha/hotel/huésped
- Night audit postea cargos diarios automáticamente
- Reportes básicos de ingresos, ocupación, pendientes

La contabilidad completa aplica cuando el hotel necesita:
- Balance Sheet (activos/pasivos)
- P&L Statements (profit & loss)
- Cuentas por pagar (AP) / Cuentas por cobrar (AR)
- Bookkeeping de doble entrada
- Integración directa con contadores externos

---

## Arquitectura propuesta

### Capa nueva: `modules/accounting`

```
backend/src/modules/accounting/
├── index.ts              # Registro del módulo
├── service.ts            # Casos de uso de contabilidad
├── controller.ts         # Endpoints HTTP
├── types.ts              # DTOs
├── model.ts              # Schema DB
├── sockets.ts            # Eventos
├── validators/schema.ts  # Validación
├── usecases/
│   ├── chart-of-accounts.ts    # Catálogo de cuentas
│   ├── journal-entry.ts        # Asiento contable (doble entrada)
│   ├── general-ledger.ts       # Mayor general
│   ├── trial-balance.ts        # Balance de comprobación
│   ├── profit-loss.ts          # Estado de resultados
│   ├── balance-sheet.ts        # Balance general
│   └── period-close.ts         # Cierre contable mensual
└── tests/
    └── service.test.ts
```

### Tablas nuevas

```sql
-- Catálogo de cuentas (chart of accounts)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  code TEXT NOT NULL,           -- 1.1.1.001 (jerárquico)
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- asset | liability | equity | income | expense
  parentId TEXT,                -- jerarquía
  active INTEGER DEFAULT 1,
  UNIQUE(hotelId, code)
);

-- Asientos contables (journal entries)
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  entryDate TEXT NOT NULL,       -- fecha del asiento
  description TEXT,
  reference TEXT,                -- invoiceId, paymentId, etc.
  referenceType TEXT,            -- 'invoice' | 'payment' | 'deposit' | 'adjustment'
  period TEXT NOT NULL,          -- '2026-07' (mes contable)
  status TEXT DEFAULT 'draft',   -- draft | posted | reversed
  createdBy TEXT,
  createdAt TEXT,
  postedAt TEXT
);

-- Líneas de asiento (double entry)
CREATE TABLE journal_lines (
  id TEXT PRIMARY KEY,
  entryId TEXT NOT NULL REFERENCES journal_entries(id),
  accountId TEXT NOT NULL REFERENCES accounts(id),
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  description TEXT
);

-- Periodos contables
CREATE TABLE accounting_periods (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  period TEXT NOT NULL,         -- '2026-07'
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT DEFAULT 'open',   -- open | closed | locked
  UNIQUE(hotelId, period)
);
```

### Integración con módulos existentes

| Evento | Módulo origen | Asiento contable generado |
|--------|---------------|---------------------------|
| Factura emitida | `facturas` | Debe: Clientes / Haber: Ingresos |
| Pago recibido | `facturas` o `folios` | Debe: Bancos/Efectivo / Haber: Clientes |
| Cargo nocturno | `folios` (night audit) | Debe: Clientes / Haber: Ingresos habitación |
| Gasto registrado | `gastos` | Debe: Gastos / Haber: Bancos/Efectivo |
| Nota de crédito | `facturas` | Debe: Devoluciones / Haber: Clientes |
| Depósito/Cargo tarjeta | `payment-requests` | Debe: Bancos / Haber: Pasivos diferidos |

### Conectores necesarios

```typescript
// connectors/facturas-accounting.ts
// connectors/folios-accounting.ts
// connectors/gastos-accounting.ts
// connectors/pagos-accounting.ts
```

Cada conector escucha eventos del módulo origen y crea asientos contables.

---

## API endpoints

```
GET    /api/accounting/accounts          → Catálogo de cuentas
POST   /api/accounting/accounts          → Crear cuenta
PUT    /api/accounting/accounts/:id      → Editar cuenta

GET    /api/accounting/journal           → Listar asientos (filtro por periodo)
POST   /api/accounting/journal           → Crear asiento manual
POST   /api/accounting/journal/:id/post  → Contabilizar asiento
POST   /api/accounting/journal/:id/reverse → Revertir asiento

GET    /api/accounting/ledger?account=X  → Mayor de cuenta
GET    /api/accounting/trial-balance?period=2026-07 → Balance comprobación
GET    /api/accounting/pnl?period=2026-07 → Estado resultados
GET    /api/accounting/balance-sheet?period=2026-07 → Balance general

POST   /api/accounting/periods           → Abrir periodo
PUT    /api/accounting/periods/:id/close → Cerrar periodo
```

---

## Reglas de contabilidad

1. **Doble entrada**: cada transacción afecta al menos 2 cuentas (debe = haber)
2. **Período mensual**: los asientos se agrupan por mes contable
3. **No editar asientos posteados**: solo reversiones
4. **Integración vía conectores**: nunca import directo entre módulos
5. **Moneda**: usar la moneda del hotel (de `hotels`), convertir con `currency` service

---

## Dependencias externas

| Dependencia | Por qué |
|-------------|---------|
| Catálogo de cuentas estándar | Base para reportes fiscalmente válidos |
| knowledge de contabilidad | Quién diseña el plan de cuentas inicial |
| Contador del hotel | Define reglas de negocio (IVA, retenciones, etc.) |

---

## Estimación

| Fase | Items | Esfuerzo estimado |
|------|-------|-------------------|
| 1 | Schema + modelo + ORM | 2-3 días |
| 2 | Journal entries (CRUD + post/reverse) | 3-4 días |
| 3 | Chart of accounts | 2 días |
| 4 | Reportes (ledger, trial balance, P&L, BS) | 4-5 días |
| 5 | Conectores (facturas, folios, gastos, pagos) | 3-4 días |
| 6 | Tests + QA | 2-3 días |
| **Total** | | **16-21 días** |

---

## Estado actual (2026-07-04)

| Componente | Estado |
|------------|--------|
| Flujo simple (folio → factura → pago) | ✅ Producción |
| Auto-post cargos check-in | ✅ Implementado |
| Night audit automático | ✅ Implementado |
| Reportes básicos (ingresos, ocupación) | ✅ Existente |
| Catálogo de cuentas | ❌ No iniciado |
| Asientos contables | ❌ No iniciado |
| P&L / Balance Sheet | ❌ No iniciado |
| Conectores contables | ❌ No iniciado |
