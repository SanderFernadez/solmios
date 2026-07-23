# Spec: Pantalla de Cocina (KDS — Kitchen Display System)

## Objetivo
Que cada estación (cocina, bar, parrilla…) tenga **su propia pantalla** y vea las líneas de comanda que le
tocan en tiempo real, marcándolas `preparing → ready → served`. Las estaciones son **configurables por hotel**.

## DB
- `restaurant_stations(id, hotelId, name, active, sortOrder)` — catálogo configurable; cada fila = una pantalla.
- Reusa `restaurant_order_items` (`status` por línea + `stationId`/`stationName` snapshot de la estación resuelta).
- El KDS de una estación es una **vista** sobre las líneas activas cuyo `stationId` = esa estación.

## Ruteo (config, NO hardcode)
- `menu_categories.stationId` define a qué pantalla van los ítems de la categoría (ej. "Cócteles" → Bar).
- `menu_items.stationId` (opcional) sobrescribe por ítem.
- Al enviar la comanda, la línea **congela** `stationId = item.stationId ?? category.stationId ?? 1ª activa`.

## API
- `GET /api/restaurant/stations` · `POST` · `PUT /:id` · `DELETE /:id` — CRUD del catálogo de estaciones.
- `GET /api/restaurant/kds?station=<stationId>` — líneas en estado `new`/`preparing`/`ready` de ESA estación,
  agrupadas por comanda, ordenadas por `openedAt` (FIFO). `moduleGuard('restaurant')` + `guard('restaurant','view')`.
  Cada pantalla física abre el KDS con su propio `stationId`.
- `PUT /api/restaurant/kds/lines/:id` — body `{ status }`; transición del estado de la línea. `guard('restaurant','edit')`.
- Eventos de socket: `order.sent` (nueva comanda a cocina), `line.status_changed` (para refrescar sin polling).

## Reglas (RFC 2119)
- El KDS **MUST** mostrar solo líneas de comandas del hotel del usuario (multi-tenant por `hotelId`).
- Las transiciones válidas de una línea **MUST** ser `new→preparing→ready→served` (y `→cancelled` desde
  new/preparing); el sistema **MUST** rechazar saltos inválidos (ej. `served→preparing`) con 400.
- Una línea `cancelled`/`served` **MUST NOT** aparecer en la cola activa del KDS.
- El estado de la **orden** se deriva: la orden pasa a `ready` cuando **todas** sus líneas activas están `ready`,
  y a `served` cuando todas están `served`. El sistema **MUST** recalcular el estado agregado al cambiar una línea.
- El ruteo por estación **MUST** usar `line.stationId` (snapshot congelado en la comanda). La resolución
  **MUST** ser `item.stationId ?? category.stationId ?? primera estación activa del hotel`; si el hotel no tiene
  ninguna estación, la línea **MUST** caer en una cola "Sin estación" (fail-safe, la comida no se pierde).
- Las estaciones **MUST** ser configurables por hotel (CRUD); el sistema **MUST NOT** asumir estaciones fijas.
- Borrar una estación con líneas históricas **MUST NOT** romperlas (la línea guarda `stationName` snapshot).
- El endpoint **MUST** ser resiliente sin socket: el frontend **MUST** poder refrescar por polling si el bus no está.

### Escenarios
- **Given** un hotel con estaciones "Cocina" y "Bar", y una categoría "Cócteles" ruteada a Bar, **When** una
  comanda lleva 1 plato + 1 cóctel y se envía, **Then** el plato aparece en la pantalla de Cocina y el cóctel en
  la de Bar, cada uno en `new`.
- **Given** una línea `new` en Cocina, **When** el cocinero la marca `preparing` y luego `ready`, **Then** las
  transiciones se aceptan y emiten `line.status_changed`.
- **Given** todas las líneas de una comanda en `ready`, **When** se recalcula, **Then** la orden queda `ready`.
- **Given** una línea `served`, **When** se intenta volver a `preparing`, **Then** 400.
- **Given** un hotel con **una sola** estación, **When** entra cualquier comanda, **Then** todo cae en esa pantalla
  sin configurar ruteo.
- **Given** un hotel **sin** estaciones definidas, **When** entra una comanda, **Then** las líneas caen en la cola
  "Sin estación" (no se pierden).

## UI (español)
- **"Estaciones"** (config): CRUD del catálogo de pantallas por hotel (crear "Cocina", "Bar", "Parrilla"…,
  activar/desactivar, ordenar). En el editor de **categoría** hay un desplegable "Estación" (a qué pantalla rutea).
- **"Cocina/KDS"** (`pages/restaurante/cocina.vue`): la pantalla abre con **una** estación (`?station=<id>`),
  muestra sus comandas/líneas, tiempo desde `openedAt`, botones "Preparando"/"Listo". Un selector arriba permite
  cambiar de estación (para el hotel chico que usa una sola tablet). Auto-refresh por socket + fallback a polling.
  Pensada para tablet (touch, tarjetas grandes).
