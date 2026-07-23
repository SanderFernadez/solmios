# Spec: Pantalla de Cocina (KDS — Kitchen Display System)

## Objetivo
Que la cocina/barra vea las líneas de comanda entrantes en tiempo real y las marque `preparing → ready → served`.

## DB
- Reusa `restaurant_order_items` (`status` por línea: new/preparing/ready/served/cancelled, `station`).
- No hay tabla nueva: el KDS es una **vista** sobre las líneas activas agrupadas por `station`.

## API
- `GET /api/restaurant/kds?station=` — líneas en estado `new`/`preparing`/`ready` del hotel, agrupadas por
  estación y comanda, ordenadas por `openedAt` (FIFO). `moduleGuard('restaurant')` + `guard('restaurant','view')`.
- `PUT /api/restaurant/kds/lines/:id` — body `{ status }`; transición del estado de la línea. `guard('restaurant','edit')`.
- Eventos de socket: `order.sent` (nueva comanda a cocina), `line.status_changed` (para refrescar sin polling).

## Reglas (RFC 2119)
- El KDS **MUST** mostrar solo líneas de comandas del hotel del usuario (multi-tenant por `hotelId`).
- Las transiciones válidas de una línea **MUST** ser `new→preparing→ready→served` (y `→cancelled` desde
  new/preparing); el sistema **MUST** rechazar saltos inválidos (ej. `served→preparing`) con 400.
- Una línea `cancelled`/`served` **MUST NOT** aparecer en la cola activa del KDS.
- El estado de la **orden** se deriva: la orden pasa a `ready` cuando **todas** sus líneas activas están `ready`,
  y a `served` cuando todas están `served`. El sistema **MUST** recalcular el estado agregado al cambiar una línea.
- El ruteo por estación **MUST** usar `line.station` (snapshot); si el ítem no declara estación, **MUST** caer
  al default `kitchen` (fail-safe, la comida no se pierde).
- El endpoint **MUST** ser resiliente sin socket: el frontend **MUST** poder refrescar por polling si el bus no está.

### Escenarios
- **Given** una comanda con 2 líneas (1 `kitchen`, 1 `bar`), **When** se envía a cocina, **Then** cada línea
  aparece en la cola de su estación en `new`.
- **Given** una línea `new` en cocina, **When** el cocinero la marca `preparing` y luego `ready`, **Then** las
  transiciones se aceptan y emiten `line.status_changed`.
- **Given** todas las líneas de una comanda en `ready`, **When** se recalcula, **Then** la orden queda `ready`.
- **Given** una línea `served`, **When** se intenta volver a `preparing`, **Then** 400.
- **Given** un ítem sin `station`, **When** entra al KDS, **Then** cae en la cola `kitchen`.

## UI (español)
- "Cocina" (`pages/restaurante/cocina.vue`): columnas por estación (Cocina, Barra, Parrilla…), tarjetas de
  comanda con sus líneas, tiempo transcurrido desde `openedAt`, botones "Preparando"/"Listo". Auto-refresh por
  socket con fallback a polling. Pensada para tablet en la cocina (touch, tarjetas grandes).
