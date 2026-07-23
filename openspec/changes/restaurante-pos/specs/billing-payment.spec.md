# Spec: Cuenta y Cobro (billing & settlement)

## Objetivo
Cerrar una comanda: calcular la cuenta (con propina), y cobrarla por **una** de dos vías mutuamente
excluyentes — **cargo a la habitación** (folio) o **cobro directo** (efectivo/tarjeta) — con el ingreso
contabilizado **una sola vez**.

## DB
- Reusa `restaurant_orders` (`subtotal, tax, tip, total, settlement, folioId, paymentId, closedAt`).
- **No** hay tabla de dinero nueva: el dinero vive en `folio_charges` (cargo) o `payments` (cobro directo).

## API
- `POST /api/restaurant/orders/:id/bill` — body `{ tip? }`; recalcula subtotal/tax, fija propina, orden→`billed`.
- `POST /api/restaurant/orders/:id/charge-to-room` — resuelve folio por `reservationId` y postea el cargo.
  Requiere que la comanda tenga `reservationId` de una reserva `checked_in`.
- `POST /api/restaurant/orders/:id/pay` — body `{ method }`; crea `payment` directo `status:'completed'`.
- Todas: `moduleGuard('restaurant')` + `guard('restaurant','edit')`.

## Reglas (RFC 2119)
- `subtotal` y `tax` **MUST** recalcularse en el servidor al facturar (Σ `lineTotal` de líneas no canceladas +
  impuesto de config); el cliente **MUST NOT** poder fijar el total.
- `tip` **MUST** ser ≥ 0; **MUST** sumarse al `total` pero **MUST NOT** llevar impuesto de venta.
- El `settlement` **MUST** ser exactamente uno: `folio` **XOR** `payment`. El sistema **MUST** rechazar cobrar
  una comanda ya `charged`/`paid` (idempotencia; 409) — **una venta se cuenta una vez**.
- **Cargo a habitación** (`charge-to-room`):
  - El sistema **MUST** resolver el folio abierto por `reservationId` (o abrirlo) y postear vía `folios.postCharge`
    con `category:'restaurant'`, `source:'pos'`, `description` = "Restaurante · comanda #<number>".
  - El sistema **MUST NOT** emitir un asiento contable propio: `onFolioCharged` (existente) ya devenga el ingreso.
  - Si la comanda no tiene `reservationId` de una reserva activa, el sistema **MUST** rechazar (solo cabe cobro directo).
  - Tras el cargo: orden→`charged`, guarda `folioId`, mesa→`free`.
- **Cobro directo** (`pay`):
  - El sistema **MUST** crear `payments.createPayment({ type:'charge', method, amount: total, status:'completed' })`.
    El arqueo de caja y el débito de Caja los hace `onPaymentCompleted` (existente).
  - El connector `restaurante-accounting` **MUST** reconocer la **contrapartida de ingreso** (Ventas
    Restaurante neto + ITBIS por pagar) **sin** volver a mover Caja — evitando el doble conteo.
  - Si `method='cash'` y no hay turno de caja abierto, el sistema **MUST** rechazar (criterio del resto del sistema).
  - Tras el cobro: orden→`paid`, guarda `paymentId`, mesa→`free`.
- Los conectores **MUST** ser best-effort para el asiento (un fallo contable **MUST NOT** revertir el cobro real),
  pero el cargo/pago **MUST** ser atómico respecto del cambio de estado de la orden.

### Escenarios
- **Given** una comanda servida de $50 de un huésped hospedado, **When** se hace `charge-to-room`, **Then** aparece
  un `folio_charge` de $50 (+ITBIS) en la habitación, la orden queda `charged`, y NO se crea un payment.
- **Given** la misma comanda, **When** se intenta `pay` después de `charge-to-room`, **Then** 409 (ya liquidada).
- **Given** una comanda takeaway de $30, **When** se hace `pay` con `method='cash'` y hay turno abierto, **Then**
  se crea un payment completed $30, entra al arqueo, y el ingreso "Ventas Restaurante" se asienta una vez.
- **Given** una comanda con `tip=5` sobre subtotal 20 (+ITBIS 3.6), **Then** `total = 28.6`, la propina no lleva impuesto.
- **Given** una comanda de un cliente sin reserva, **When** se intenta `charge-to-room`, **Then** se rechaza.

## UI (español)
- Pantalla "Cobrar" (`pages/restaurante/cobrar.vue` o modal): muestra el desglose (subtotal, ITBIS, propina, total),
  campo de propina, y dos botones: **"Cargar a la habitación"** (habilitado solo si hay reserva activa) y
  **"Cobro directo"** (efectivo/tarjeta). Confirmación → estado final. Sin doble cobro (deshabilita tras liquidar).
