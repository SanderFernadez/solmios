# Design: restaurante-pos

## Módulo

Un módulo nuevo `backend/src/modules/restaurant/` (estructura canónica `make:module Restaurant`) +
frontend `frontend/src/pages/restaurante/`. Registro en `composition-root.ts` (patrón idéntico a
`AccountingModule()`/`TreasuryModule()`: import → array `mods` → `system.addModule`). Dos conectores en
`src/connectors/`. Entitlement por `moduleGuard('restaurant')` + catálogo admin. Permiso `restaurant:*`.

## Modelo de datos (ORM — inglés, `hotelId` en toda tabla, id = TEXT UUID, timestamps camelCase)

### `menu_categories`
| campo | tipo | notas |
|-------|------|-------|
| id | text | UUID |
| hotelId | text | multi-tenant, indexed |
| name | text | "Entradas", "Platos fuertes", "Bebidas" |
| sortOrder | number | orden de despliegue |
| active | boolean | INTEGER 0/1 |

### `menu_items`
| campo | tipo | notas |
|-------|------|-------|
| id | text | UUID |
| hotelId | text | indexed |
| categoryId | text | FK lógica a menu_categories, indexed |
| name | text | |
| description | text | opcional |
| price | number | **unitario, sin impuesto** (el impuesto se aplica al facturar, como folio_charges) |
| taxRate | number | opcional; si null → `taxRateFor(config, hotelId)` (NO hardcode) |
| station | text | ruteo KDS: `kitchen` \| `bar` \| `grill`… (config del hotel; default `kitchen`) |
| available | boolean | 86'd = out of stock del día |
| imageUrl | text | opcional |
| sortOrder | number | |

### `restaurant_tables`
| campo | tipo | notas |
|-------|------|-------|
| id | text | UUID |
| hotelId | text | indexed |
| name | text | "Mesa 4", "Barra 2" |
| zone | text | "Salón", "Terraza", "Piscina" |
| capacity | number | comensales |
| status | text | `free` \| `occupied` \| `reserved` (derivable de orden abierta, pero se cachea) |

### `restaurant_orders`  (la comanda / cuenta)
| campo | tipo | notas |
|-------|------|-------|
| id | text | UUID |
| hotelId | text | indexed |
| number | text | correlativo por hotel (counter atómico en `configuration`, patrón invoice_counter) |
| type | text | `dine_in` \| `room_service` \| `takeaway` |
| tableId | text | requerido si `dine_in`, null si no |
| reservationId | text | requerido si `room_service` (para resolver el folio); null si no |
| guestId | text | opcional (denormalizado de la reserva) |
| roomId | text | opcional |
| waiterId | text | `users.id` del mesero (resolver nombre por `/usuarios`, regla del proyecto) |
| status | text | `open` \| `sent` \| `preparing` \| `ready` \| `served` \| `billed` \| `charged` \| `paid` \| `cancelled` |
| subtotal | number | Σ líneas (neto) — **calculado del server, nunca del cliente** |
| tax | number | ITBIS calculado |
| tip | number | propina (opcional) |
| total | number | subtotal + tax + tip |
| settlement | text | `folio` \| `payment` \| null — cómo se cerró |
| folioId / paymentId | text | trazabilidad de la salida (idempotencia del settle) |
| openedAt / closedAt | text | ISO |

### `restaurant_order_items`  (líneas de la comanda)
| campo | tipo | notas |
|-------|------|-------|
| id | text | UUID |
| hotelId | text | indexed |
| orderId | text | indexed |
| menuItemId | text | snapshot: se copia name/price al crear (si el ítem cambia de precio después, la comanda no muta) |
| name | text | snapshot del nombre |
| unitPrice | number | snapshot del precio neto |
| quantity | number | ≥1 |
| notes | text | "sin cebolla", modificadores |
| station | text | snapshot para KDS |
| status | text | `new` \| `preparing` \| `ready` \| `served` \| `cancelled` (KDS por línea) |
| lineTotal | number | unitPrice * quantity (server) |

> **Snapshot de precio/nombre en la línea**: una comanda es un contrato con el comensal; si mañana sube
> el precio del ítem del menú, la cuenta ya emitida NO cambia. Mismo criterio que un folio_charge.

## Máquina de estados de la comanda

```
open ──(enviar a cocina)──> sent ──> preparing ──> ready ──> served ──(pedir cuenta)──> billed
                                                                                          │
                                              ┌───────────────────────────────────────────┤
                                       (cargar a habitación)                        (cobro directo)
                                              ▼                                             ▼
                                          charged                                         paid
```
- `cancelled` alcanzable desde cualquier estado previo a `charged`/`paid` (con permiso `restaurant:delete`).
- Las líneas tienen su **propio** ciclo KDS (`new→preparing→ready→served`) — el estado de la orden es
  agregado (una orden está `ready` cuando todas sus líneas activas están `ready`).

## Reconocimiento de ingreso (el punto contable delicado)

Dos caminos, **mutuamente excluyentes** (por eso `settlement` es un enum, no dos flags):

| Salida | Qué se dispara | Asiento (quién lo hace) |
|--------|----------------|-------------------------|
| **Cargo a habitación** (`charged`) | `folios.postCharge(category:'restaurant')` → evento `onFolioCharged` | `folios-accounting.ts` **YA EXISTE**: DR Clientes / CR Ingresos + ITBIS. El POS **no** agrega asiento. |
| **Cobro directo** (`paid`) | `payments.createPayment(status:'completed')` → `onPaymentCompleted` | `payments-accounting.ts` **YA EXISTE**: DR Caja / CR (contrapartida). |

**El hueco**: en el cobro directo, `onPaymentCompleted` debita Caja pero la **contrapartida de ingreso**
("Ventas Restaurante") no la conoce un pago suelto sin folio. → connector **`restaurante-accounting.ts`**
nuevo que, en `onOrderPaid` (venta directa, sin folio), reconoce **DR/CR de ingreso** de la venta neta +
ITBIS, coordinado con lo que ya hace payments-accounting para **no** doblar la caja.

> **Regla anti-doble-conteo (cardinal):** si la orden se **cargó al folio**, el ingreso ya está devengado
> por `folios-accounting`; el connector del POS **no toca** contabilidad. Si se **pagó directo**, el POS
> reconoce el ingreso pero **no** vuelve a mover caja (eso lo hizo payments-accounting). La venta se cuenta
> **una sola vez**. El detalle exacto de cuentas se cierra en RES-6 leyendo `accounting/usecases/account-codes.ts`
> (agregar código de cuenta `Ventas Restaurante` al plan base sembrado).

## Integración con caja (arqueo)

El cobro directo en efectivo entra al turno de caja abierto **automáticamente** porque `onPaymentCompleted`
ya alimenta `payments-caja`. El POS **no** abre/cierra turnos — usa el turno de `finance.caja` vigente. Si no
hay turno abierto y el método es `cash`, el cobro se rechaza con el mismo criterio que el resto del sistema.

## Resolución del folio (room service / cargar a habitación)

Patrón canónico existente (`settle-folio-at-checkout.ts:35`):
```
const list = await folios.list({ reservationId, status:'open' }, user)
let folio = list.data?.[0] ?? await folios.open({ hotelId, reservationId, guestId, roomId }, user)
await folios.postCharge(folio.id, { description, amount, quantity, category:'restaurant', source:'pos' }, user)
```
- El huésped **debe tener una reserva activa** (`checked_in`) para cargar a la habitación. Si no, la UI solo
  ofrece cobro directo.
- `hotelId` se fuerza del JWT en folios (anti-IDOR) — el POS nunca lo manda en el body.

## Tiempo real (KDS)

El KDS necesita ver comandas entrando en vivo. El módulo emite por el bus de sockets del framework (patrón
`setSockets`) los eventos `order.sent` / `line.status_changed`; el frontend KDS se suscribe. Fallback: polling
cada N segundos si el socket no está disponible (mismo criterio defensivo que el resto de la app).

## Permisos y entitlement

- **Permiso** `restaurant` en `shared/permissions.ts`: `MODULES.restaurant`, `MODULE_ACTIONS.restaurant =
  ['view','create','edit','delete']`, y en `DEFAULT_ROLE_PERMISSIONS` para `hotel_admin` (completo) +
  `receptionist` (view/create para tomar comandas). Se puede pensar un rol `waiter`/`mesero` a futuro.
- **Entitlement**: entrada `restaurant` en `admin/usecases/modules.ts` `MODULE_CATALOG` (grupo top-level
  nuevo "Restaurante" con submódulos `restaurant.menu`, `restaurant.pos`, `restaurant.kds`, o key única
  `restaurant` — se decide en RES-0). `moduleGuard('restaurant')` en cada ruta.
- **⚠️ Deuda conocida (heredada de contabilidad):** habilitar en un hotel de prod = 3 pasos (RUN_MIGRATE +
  `plans.modules` + `UPDATE roles.permissions`). Documentado en memoria `contabilidad-tesoreria-desplegado`;
  el rollout del POS reusa el mismo procedimiento.

## Rutas API (todas `moduleGuard('restaurant')` + `guard('restaurant', accion)`)

| Método | Ruta | Permiso |
|--------|------|---------|
| GET/POST/PUT/DELETE | `/api/restaurant/categories` | restaurant:view/create/edit/delete |
| GET/POST/PUT/DELETE | `/api/restaurant/menu-items` | restaurant:view/create/edit/delete |
| PUT | `/api/restaurant/menu-items/:id/availability` | restaurant:edit (86' rápido) |
| GET/POST/PUT | `/api/restaurant/tables` | restaurant:view/create/edit |
| GET/POST | `/api/restaurant/orders` (list / crear comanda) | restaurant:view/create |
| POST | `/api/restaurant/orders/:id/items` (agregar línea) | restaurant:create |
| PUT/DELETE | `/api/restaurant/orders/:id/items/:lineId` | restaurant:edit/delete |
| POST | `/api/restaurant/orders/:id/send` (a cocina) | restaurant:edit |
| POST | `/api/restaurant/orders/:id/bill` (calcular cuenta + propina) | restaurant:edit |
| POST | `/api/restaurant/orders/:id/charge-to-room` (→ folio) | restaurant:edit |
| POST | `/api/restaurant/orders/:id/pay` (→ payment directo) | restaurant:edit |
| POST | `/api/restaurant/orders/:id/cancel` | restaurant:delete |
| GET | `/api/restaurant/kds` (líneas activas por estación) | restaurant:view |
| PUT | `/api/restaurant/kds/lines/:id` (transición de estado) | restaurant:edit |

## Verificación (gate)

`arckode analyze` 0 violaciones · `bun run typecheck` + `bun test` (backend) · `cd frontend && bun run typecheck`
(vue-tsc **-b**) + `bun run build` · services ≤200 líneas · todo `findById` con `assertOwnership` · sin SQL crudo
en services · impuesto/moneda de config · UI español / DB-API inglés.
