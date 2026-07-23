# Spec: Carta / Menú + Estaciones (menu)

## Objetivo
Catálogo de la carta (categorías + ítems con precio/impuesto/disponibilidad) y el catálogo **configurable de
estaciones** (pantallas KDS) al que rutean las categorías.

## DB
- `restaurant_stations(id, hotelId, name, active, sortOrder)` — catálogo configurable de pantallas.
- `menu_categories(id, hotelId, name, stationId, sortOrder, active)` — `stationId` = a qué pantalla van sus ítems.
- `menu_items(id, hotelId, categoryId, name, description, price, taxRate?, stationId?, available, imageUrl?, sortOrder)`
  — `stationId` opcional sobrescribe el de la categoría.
- `price` es **neto** (sin impuesto). El impuesto se aplica al facturar, igual que `folio_charges`.

## API
- `GET /api/restaurant/stations` · `POST` · `PUT /:id` · `DELETE /:id` — CRUD de estaciones (pantallas).
- `GET /api/restaurant/categories` · `POST` · `PUT /:id` · `DELETE /:id` (incluye `stationId`).
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
- Las estaciones **MUST** ser CRUD por hotel; el sistema **MUST NOT** asumir estaciones fijas (`kitchen`/`bar` hardcodeadas).
- `category.stationId` y `menu_item.stationId` **MUST** referenciar una estación del **mismo hotel** (validar) o ser null.
- Borrar una estación **MUST NOT** romper categorías/ítems que la referencian: quedan con `stationId` colgado y
  el ruteo cae al fallback (1ª estación activa / "Sin estación"). El sistema **MAY** advertir antes de borrar.

### Escenarios
- **Given** estaciones "Cocina" y "Bar", **When** se crea la categoría "Cócteles" con `stationId`=Bar, **Then**
  sus ítems rutean al Bar en el KDS.
- **Given** una categoría "Bebidas" con 3 ítems, **When** se intenta `DELETE` la categoría, **Then** responde 409
  y no borra nada.
- **Given** un ítem sin `taxRate`, **When** se factura en una comanda, **Then** el ITBIS se calcula con la tasa de
  `configuration('taxes')` del hotel.
- **Given** un ítem `available=false`, **When** el mesero intenta agregarlo a una comanda, **Then** se rechaza
  con mensaje "no disponible".

## UI (español)
- Página admin "Estaciones": CRUD de pantallas (Cocina, Bar, Parrilla…), activar/ordenar.
- Página admin "Carta" (`pages/restaurante/carta.vue`): lista por categoría; el editor de **categoría** tiene un
  desplegable "Estación" (a qué pantalla rutea); el editor de **ítem** (nombre, descripción, precio, impuesto
  opcional, estación-override, imagen, disponible), reordenar, toggle 86'.
- Sin `fetch()` en componentes → `RestaurantService`. Precios formateados con `useCurrency` (moneda de config).
