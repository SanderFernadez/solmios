# Change Proposal: contabilidad-tesoreria

## Summary

Agregar **contabilidad de doble entrada** (plan de cuentas, asientos, libro mayor, estados
financieros) y **tesorería completa** (flujo de caja, cuentas bancarias + conciliación, cuentas por
cobrar/pagar con aging, presupuesto) al PMS, **construidas in-house** sobre `arckode-framework`,
integradas a la infraestructura financiera que ya existe (`payments`, `facturas`, `folios`, `gastos`,
`cash`/caja, `reports`) **vía conectores**, sin duplicar datos ni romper la fuente de verdad del dinero.

> **Decisión de arquitectura (confirmada con el dueño):** motor contable **in-house nativo**, NO Odoo.
> Se evalúa a futuro un conector de export a un ERP/contador externo, pero el motor de doble entrada,
> reportes y tesorería viven en el PMS.

## Motivation

Hoy el sistema tiene **contabilidad simple**: cada checkout genera factura, `payments` es la fuente de
verdad del dinero, la caja hace arqueo por turno, y `reports` separa devengado (facturado) de cobrado
(ingresado). Esto alcanza para operar, pero **no produce información contable ni de tesorería formal**:

- **No hay libro mayor ni asientos**: imposible dar un Balance General, un Estado de Resultados por
  período, ni un balance de comprobación cuadrado. Un contador externo no puede auditar el hotel.
- **No hay visión de tesorería**: no se proyecta el flujo de caja, no se concilian cuentas bancarias
  de forma estructurada (solo existe `payments.reconcile()` puntual), no se ve el aging de lo que deben
  los huéspedes/empresas (AR) ni lo que el hotel debe a proveedores (AP), y no hay presupuesto.
- Un intento previo (openspec `contabilidad`, issues ACC-0..6 #327–#333) se **cerró como `invalid`**
  porque fue **auto-generado por un agente fuera de scope, sin que nadie lo pidiera**. Esta vez el
  alcance está **explícitamente solicitado y acotado** por el dueño.

### Lo que este cambio agrega (y lo que reutiliza)

| Necesidad | Estado actual | Este cambio |
|-----------|---------------|-------------|
| Fuente de verdad del dinero | ✅ tabla `payments` | **Reutiliza** — los asientos leen de acá |
| Arqueo de caja por turno | ✅ módulo `cash` | **Reutiliza** — cierre de caja → asiento |
| Devengado vs cobrado | ✅ `reports/usecases/money.ts` | **Reutiliza** — misma regla anti-doble-conteo |
| Impuestos (ITBIS) + NCF | ✅ `configuration('taxes')`, `fiscal.ts` | **Reutiliza** — asiento de impuesto por pagar |
| Plan de cuentas + asientos + mayor | ❌ no existe | **NUEVO** — módulo `accounting` |
| P&L / Balance General / Balance comprobación | ❌ no existe | **NUEVO** — módulo `accounting` |
| Flujo de caja / proyección de liquidez | ❌ no existe | **NUEVO** — módulo `treasury` |
| Cuentas bancarias + conciliación estructurada | ⚠️ parcial (`payments.reconcile`) | **NUEVO/EXTIENDE** — `treasury` |
| AR/AP con aging + proveedores | ❌ no existe | **NUEVO** — `treasury` |
| Presupuesto y control de gastos | ❌ no existe | **NUEVO** — `treasury` |

## Principio de integración (no negociable)

Del mapa de la infraestructura actual, la regla que **evita el bug histórico del doble conteo**:

> Los asientos y la tesorería leen **`payments`** (cobrado) y **`expenses`** (pagado) para la base caja,
> y **`invoices`/`folio_charges`** (devengado) para la base devengado. **Nunca se suman entre sí.**
> La brecha devengado − cobrado ES la cuenta por cobrar (AR).

- **Nunca import directo entre módulos** → todo por conectores en `src/connectors/`.
- **Nunca SQL crudo en services** → `RepositoryAdapter<T>` / `OrmRepository<T>`.
- Los asientos automáticos se disparan por **eventos existentes** (`payments.onPaymentCompleted`,
  `payments.onRefundProcessed`, `gastos.onGastosCreated`, `folios.onFolioClosed`,
  `facturas.onFacturasCreated`, `cash.onShiftClosed`). No se toca la lógica de los módulos origen.
- **Idempotencia**: cada asiento automático guarda `reference`+`referenceType` (ej. `paymentId`) y
  **no se duplica** si el evento se re-emite (mismo patrón de dedup que `cash_movements.paymentId`).

## Alcance (scope)

**Contabilidad (módulo `accounting`)**
1. Plan de cuentas jerárquico (chart of accounts) + seed base hotelero (DGII-aware).
2. Asientos de doble entrada (debe = haber): manuales + automáticos por conector.
3. Post / reverse de asientos; asientos posteados **no se editan** (solo reversión).
4. Períodos contables mensuales (open / closed / locked).
5. Libro mayor (general ledger) + balance de comprobación (trial balance).
6. Estados financieros: Estado de Resultados (P&L) + Balance General (balance sheet).
7. Frontend: plan de cuentas, libro diario, mayor, 4 reportes.

**Tesorería (módulo `treasury`)**
1. Cuentas bancarias + movimientos + conciliación bancaria estructurada.
2. Flujo de caja (cash flow): proyección y dashboard de liquidez.
3. Cuentas por cobrar (AR) con aging (desde devengado − cobrado).
4. Cuentas por pagar (AP) + proveedores con aging (desde `expenses` impagos).
5. Presupuesto por categoría/período + control de gastos contra presupuesto.
6. Frontend: dashboard de liquidez, conciliación, AR/AP aging, presupuesto.

**Transversal**
- Permisos `accounting:*` y `treasury:*` + registro en el catálogo de módulos (entitlements/plan).
- Gate de verificación (typecheck + `arckode analyze` 0 violaciones + tests + e2e).

### Fuera de scope (explícito)
- Integración fiscal real con la autoridad (DGII/DIAN/etc.) — `fiscal.ts` sigue en stub.
- Conector de export a Odoo / ERP externo (se evalúa después, como fase separada).
- Conversión multi-moneda en asientos (se asume moneda única por hotel, igual que hoy).
- Activos fijos / depreciación, conciliación automática vía API bancaria (import de extractos es manual/CSV).

## Módulos afectados

| Módulo | Impacto |
|--------|---------|
| `accounting` (NUEVO) | Motor contable completo |
| `treasury` (NUEVO) | Tesorería completa |
| `src/connectors/` (NUEVOS) | `payments-accounting`, `gastos-accounting`, `folios-accounting`, `facturas-accounting`, `cash-accounting` |
| `src/composition-root.ts` | Wiring de los 2 módulos + 5 conectores |
| `shared/permissions.ts` | Nuevos módulos de permiso `accounting`, `treasury` |
| `admin/usecases/modules.ts` | Nuevas claves de catálogo `accounting`, `treasury` (entitlements) |
| Frontend `pages/contabilidad/`, `pages/tesoreria/` (NUEVOS) | UI |
| `payments`, `facturas`, `folios`, `gastos`, `cash` | **Sin cambios** — solo se consumen sus eventos |

## Rollback plan

- Los 2 módulos son **aditivos y aislados**: se registran en `composition-root.ts` y se pueden
  **desregistrar** (comentar 2 módulos + 5 conectores) sin afectar la operación existente.
- Las tablas nuevas (`accounts`, `journal_entries`, `journal_lines`, `accounting_periods`,
  `bank_accounts`, `bank_movements`, `suppliers`, `budgets`) son **independientes**: dropearlas no
  toca ninguna tabla financiera existente.
- Los conectores son **best-effort de solo-lectura de eventos**: si un asiento automático falla, el
  módulo origen (cobro, gasto) **no se ve afectado** (el dinero real ya está en `payments`).
- Los asientos automáticos guardan `reference` → se pueden **recomputar/borrar en bloque** por período
  sin perder el dato financiero fuente.
- El módulo se libera por **entitlement de plan** (`accounting`/`treasury`): si algo sale mal en prod,
  se apaga el módulo desde el catálogo sin desplegar.

## Referencia MisterPlan

MisterPlan (PMS de referencia del proyecto) incluye módulo de **Contabilidad** y **Tesorería/Bancos**
en su tier profesional (plan de cuentas, asientos, balance, conciliación bancaria, flujo de caja). Este
cambio replica esa capacidad de forma nativa. *(Confirmar equivalencia exacta de pantallas de MisterPlan
en la fase de diseño de UI — ver `design.md`.)*

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Doble conteo (devengado + cobrado) | Regla de integración estricta; asientos leen fuente correcta; tests anti-doble-conteo (heredados de #333) |
| Asientos duplicados por re-emisión de eventos | Dedup por `reference`+`referenceType` (patrón `cash_movements.paymentId`) |
| Plan de cuentas mal diseñado | Seed base revisado; el catálogo lo puede ajustar el contador del hotel |
| Balance descuadrado | Invariante `SUM(debit)=SUM(credit)` validada en cada asiento; trial balance como gate |
| Complejidad para el usuario | Asientos automáticos por defecto; el usuario ve reportes, no asienta a mano salvo ajustes |
