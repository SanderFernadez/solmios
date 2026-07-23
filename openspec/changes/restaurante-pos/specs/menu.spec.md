# Spec: Carta / Menú (menu)

## Objetivo
Catálogo de la carta del restaurante: categorías y ítems con precio, impuesto, disponibilidad y estación KDS.

## DB
- `menu_categories(id, hotelId, name, sortOrder, active)` — ver design.md.
- `menu_items(id, hotelId, categoryId, name, description, price, taxRate?, station, available, imageUrl?, sortOrder)`.
- `price` es **neto** (sin impuesto). El impuesto se aplica al facturar, igual que `folio_charges`.

## API
- `GET /api/restaurant/categories` · `POST` · `PUT /:id` · `DELETE /:id`
- `GET /api/restaurant/menu-items?categoryId=` · `POST` · `PUT /:id` · `DELETE /:id`
- `PUT /api/restaurant/menu-items/:id/availability` — toggle rápido `available` (86' del día).
- Todas: `moduleGuard('restaurant')` + `guard('restaurant', accion)`. `hotelId` del JWT.

## Reglas (RFC 2119)
- El sistema **MUST** rechazar un `menu_item` sin `categoryId` válido del mismo hotel (`ValidationError`).
- `price` **MUST** ser ≥ 0; el sistema **MUST** rechazar precios negativos o `NaN`.
- Si `taxRate` es null, el facturado **MUST** usar `taxRateFor(config, hotelId)` — el impuesto **MUST NOT**
  estar hardcodeado.
- El sistema **MUST NOT** borrar una categoría con ítems asociados (`ConflictError` 409); primero reasignar/borrar ítems.
- Un ítem con `available=false` **MUST** poder verse en la carta admin pero **MUST NOT** poder agregarse a una comanda nueva.
- Borrar un `menu_item` referenciado por líneas de comandas históricas **MUST** ser un soft-delete o estar
  permitido sin romper las comandas (las líneas guardan snapshot de name/price → la comanda sobrevive).

### Escenarios
- **Given** una categoría "Bebidas" con 3 ítems, **When** se intenta `DELETE` la categoría, **Then** responde 409
  y no borra nada.
- **Given** un ítem sin `taxRate`, **When** se factura en una comanda, **Then** el ITBIS se calcula con la tasa de
  `configuration('taxes')` del hotel.
- **Given** un ítem `available=false`, **When** el mesero intenta agregarlo a una comanda, **Then** se rechaza
  con mensaje "no disponible".

## UI (español)
- Página admin "Carta" (`pages/restaurante/carta.vue`): lista por categoría, alta/edición de ítem (nombre,
  descripción, precio, impuesto opcional, estación, imagen, disponible), reordenar, toggle 86'.
- Sin `fetch()` en componentes → `RestaurantService`. Precios formateados con `useCurrency` (moneda de config).
