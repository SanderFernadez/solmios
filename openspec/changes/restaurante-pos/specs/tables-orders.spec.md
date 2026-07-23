# Spec: Mesas y Comandas (tables & orders)

## Objetivo
Gestión del salón (mesas por zona) y del ciclo de una comanda: abrir, agregar líneas, enviar a cocina, servir.

## DB
- `restaurant_tables(id, hotelId, name, zone, capacity, status)` — `status` ∈ {free, occupied, reserved}.
- `restaurant_orders(id, hotelId, number, type, tableId?, reservationId?, guestId?, roomId?, waiterId, status,
  subtotal, tax, tip, total, settlement?, folioId?, paymentId?, openedAt, closedAt?)`.
- `restaurant_order_items(id, hotelId, orderId, menuItemId, name, unitPrice, quantity, notes?, station, status, lineTotal)`.
- `order.number` = correlativo por hotel (counter atómico en `configuration`, patrón `invoice_counter`).

## API
- `GET/POST/PUT /api/restaurant/tables`
- `GET /api/restaurant/orders?status=&tableId=` · `POST /api/restaurant/orders` (abrir comanda)
- `POST /api/restaurant/orders/:id/items` · `PUT /:id/items/:lineId` · `DELETE /:id/items/:lineId`
- `POST /api/restaurant/orders/:id/send` (open→sent, dispara KDS)
- `POST /api/restaurant/orders/:id/cancel`

## Reglas (RFC 2119)
- Una comanda `type='dine_in'` **MUST** tener `tableId`; `type='room_service'` **MUST** tener `reservationId`;
  `takeaway` **MUST** tener ninguno de los dos. El sistema **MUST** rechazar combinaciones inválidas.
- `subtotal`, `tax`, `total`, `lineTotal` **MUST** calcularse en el servidor a partir de `unitPrice*quantity`
  y la tasa de impuesto; el sistema **MUST NOT** confiar en montos enviados por el cliente.
- Al agregar una línea, el sistema **MUST** copiar `name`, `unitPrice` y `station` del `menu_item` (snapshot);
  cambios posteriores al ítem **MUST NOT** alterar comandas existentes.
- `quantity` **MUST** ser ≥ 1 entero.
- El sistema **MUST** rechazar agregar líneas a una comanda en estado `charged`/`paid`/`cancelled` (409).
- Abrir una comanda en una mesa `occupied` **MUST** rechazarse o adjuntarse a la comanda abierta existente
  (una mesa, una comanda abierta) — **MUST NOT** crear dos comandas abiertas para la misma mesa.
- Cancelar una comanda **MUST** liberar la mesa (`status=free`) y **MUST** requerir `restaurant:delete`.
- `waiterId` **MUST** guardar `users.id`; el nombre se resuelve por `GET /api/usuarios` (regla del proyecto),
  **MUST NOT** por `employee-profiles`.
- Multi-tenant: todo `findById` **MUST** ir seguido de `auth.assertOwnership()`; `hotelId` **MUST** venir del JWT.

### Escenarios
- **Given** la mesa 4 libre, **When** el mesero abre una comanda dine_in en la mesa 4 y agrega 2× "Pizza" ($10),
  **Then** la mesa queda `occupied`, la comanda tiene subtotal 20 + ITBIS de config, y `number` correlativo.
- **Given** una comanda ya abierta en la mesa 4, **When** se intenta abrir otra en la mesa 4, **Then** se rechaza
  (o se devuelve la existente), nunca dos abiertas.
- **Given** una comanda `type='room_service'` sin `reservationId`, **When** se crea, **Then** 400.
- **Given** una comanda `paid`, **When** se intenta agregar una línea, **Then** 409.
- **Given** una comanda con líneas, **When** se cancela, **Then** la mesa vuelve a `free` y la comanda queda `cancelled`.

## UI (español)
- "Salón" (`pages/restaurante/salon.vue`): mapa de mesas por zona con estado por color (libre/ocupada/reservada);
  click en mesa → abrir/ver comanda.
- "Comanda" (`pages/restaurante/comanda.vue`): carta a la izquierda (por categoría), líneas a la derecha, notas
  por línea, botón "Enviar a cocina", total en vivo (computed, moneda de config).
- Sin `<a href>` internos → `<router-link>`. Nombres de mesero resueltos por `TeamService`/`/usuarios`.
