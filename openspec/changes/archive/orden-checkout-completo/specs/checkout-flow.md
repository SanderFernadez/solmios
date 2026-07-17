# Spec: Checkout que cierra la orden completa

## DB
Sin cambios de schema. Se reutilizan las tablas `folios`, `folio_charges`, `invoices`, `payments`.

## API
Sin endpoints nuevos. Se reutilizan:
- `POST /api/reservas/:id/checkout` (body `{ settle?: {method, amount, reference?} | null }`)
- `POST /api/folios/:id/charges` (body `{ description, amount, category?, quantity? }`)

Cambia el comportamiento interno de `settleFolioAtCheckout` (no su contrato).

## UI
Pantalla `/checkin`, modal de check-out (`frontend/src/pages/checkin/index.vue`).

---

## Requirement 1 — El check-out SIEMPRE emite comprobante si hay cargos

El sistema MUST emitir una factura al cerrar el folio en el check-out siempre que el folio
tenga cargos (`chargesTotal > 0`), sin importar si el saldo quedó en 0.

### Scenario: estadía pagada al 100% en el check-out
- **Given** un folio abierto con cargos por $205 y sin pagos previos
- **When** el operador hace check-out liquidando $205
- **Then** el folio queda `closed`, se emite una factura por $205 con estado `paid`
  (hereda `amountPaid` del pago del folio, sin volver a mover dinero), y el check-out
  devuelve `invoiceId` e `invoiceNumber` no nulos.

### Scenario: estadía con saldo pendiente
- **Given** un folio con cargos por $130 y un pago parcial de $50
- **When** el operador hace check-out
- **Then** se emite factura por $130 con `amountPaid = 50` y estado `pending`
  (comportamiento actual, se mantiene).

### Scenario: folio sin cargos
- **Given** un folio abierto sin cargos (`chargesTotal = 0`)
- **When** el operador hace check-out
- **Then** el folio se cierra SIN emitir comprobante (no hay nada que facturar) y
  `invoiceId` es null.

## Requirement 2 — Alta de consumos desde la pantalla de check-in

El operador MUST poder agregar un cargo al folio de un huésped in-house desde el modal de
check-out de la pantalla `/checkin`, sin ir a `/folios`.

### Scenario: cargar un consumo antes de cerrar la cuenta
- **Given** el modal de check-out abierto con el folio del huésped cargado
- **When** el operador agrega un consumo (descripción + monto + categoría) y confirma
- **Then** el cargo se postea vía `POST /api/folios/:id/charges`, el folio se recarga
  y el saldo pendiente refleja el nuevo cargo.

### Scenario: validación del formulario de cargo
- **Given** el formulario de consumo abierto
- **When** el monto es <= 0 o la descripción está vacía
- **Then** el sistema MUST NOT postear el cargo y avisa al operador.

## Requirement 3 — Aviso al cerrar la orden con deuda

El sistema MUST pedir confirmación explícita cuando el operador intenta cerrar el check-out
con saldo pendiente sin registrar un pago que lo cubra.

### Scenario: intento de check-out con saldo sin pago
- **Given** un folio con saldo pendiente > 0 y ningún método de pago seleccionado
- **When** el operador toca "Check-out"
- **Then** el sistema MUST mostrar una confirmación que informe el monto de la deuda
  ("El huésped se va con saldo pendiente de $X") y solo procede si el operador confirma.

### Scenario: check-out saldado
- **Given** un folio con saldo 0, o con método de pago seleccionado que cubre el saldo
- **When** el operador toca "Check-out"
- **Then** el check-out procede sin confirmación adicional.
