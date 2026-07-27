# Menu Combos Specification (F2)

## Purpose

Permitir vender un combo/paquete (ej. "Combo Familiar" = 2 hamburguesas + 1 papas + 2
bebidas) como una sola línea de comanda con precio propio, que se snapshotea igual que un
ítem simple y descuenta el stock de CADA componente al liquidarse. Dominio NUEVO — spec
completa.

**Corrección explícita al `proposal.md`**: el riesgo documentado dice literalmente "el
conector `restaurante-inventario` resuelve combo → N `consumeForSale`". Leído el código
real, eso violaría la regla del proyecto "Lógica en connector: Connector solo DELEGA vía
sockets" — `restauranteInventarioConnector` hoy es un `for` tonto sobre
`full.lines` que llama `consumeForSale` por cada línea con `menuItemId` (ver
`connectors/restaurante-inventario.ts:24-35`). La forma correcta, y la que exige este
spec, es que la EXPLOSIÓN combo→componentes ocurra en el usecase de `restaurant` al
agregar la línea (`addLine`/`combos-crud.ts`), generando N filas reales de
`restaurant_order_items` (una por componente, con su propio `menuItemId` y `quantity`).
El conector de inventario sigue exactamente igual que hoy — CERO cambios de código en
`restaurante-inventario.ts` — porque ya itera todas las líneas de la orden y ya llama
`consumeForSale` por cada una que tenga `menuItemId`. Esto es MÁS compatible con las
reglas del proyecto que lo que sugiere el proposal, y evita meterle lógica de dominio al
conector.

**Decisión cruzada con F1 (`menu-modifiers/spec.md`), tomada en `design.md`**: las filas
`combo_component` NUNCA aceptan modificadores (F1) en esta v1 — un componente de combo se
vende exactamente como el combo lo define, sin selector de variantes/extras. `addLine` MUST
rechazar (`ValidationError`, 400) cualquier request que combine `comboId` con un campo de
modificadores. La columna `modifiers` de F1 queda `null` en toda fila `combo_header`/
`combo_component`, sin excepción.

## Requirements

### Requirement: Definición de un combo

El sistema MUST permitir definir un combo (`menu_combos`) con nombre, descripción, precio
propio y N componentes (`menu_combo_items`), cada uno referenciando un `menuItemId`
existente del mismo hotel y una `quantity` (cuántas unidades de ese ítem incluye una
unidad del combo).

#### Scenario: Crear un combo con 3 componentes

- GIVEN "Hamburguesa" (menuItemId A), "Papas" (menuItemId B), "Refresco" (menuItemId C)
  del mismo hotel
- WHEN el admin crea `Combo Familiar` con `price=800` y componentes
  `[{A, qty:2}, {B, qty:1}, {C, qty:2}]`
- THEN el combo queda disponible en la carta con esos 3 componentes

#### Scenario: Un componente de otro hotel se rechaza

- GIVEN un `menuItemId` que pertenece a otro hotel
- WHEN se intenta agregarlo como componente del combo
- THEN el sistema responde 400 ("El ítem no existe o es de otro hotel")

### Requirement: Venta del combo como una sola línea que se descompone en filas reales

Al agregar un combo a una comanda, el sistema MUST crear:
1. Una fila **header** en `restaurant_order_items` con `kind='combo_header'`,
   `comboId` = el combo vendido, `menuItemId=null`, `name` = nombre del combo (snapshot),
   `unitPrice` = precio del combo (snapshot), `stationId=null` (no rutea a ningún KDS),
   `lineTotal = unitPrice × quantity`.
2. Una fila **component** por cada componente del combo, con `kind='combo_component'`,
   `parentLineId` = id de la fila header, `menuItemId` = el ítem componente (snapshot,
   IGUAL que una línea normal), `quantity` = `componente.quantity × quantity del combo
   vendido`, `unitPrice=0`, `lineTotal=0`, `taxRate=0`, y `stationId`/`stationName`
   resueltos EXACTAMENTE con `resolveStation()` (mismo código que una línea normal, sin
   cambios) para que cada componente rutee a su pantalla KDS correcta.

El precio completo del combo vive SOLO en el header; los componentes valen 0 para no
duplicar el monto cuando `recomputeTotals` suma `lineTotal` de TODAS las filas de la orden
— esto significa que `order-totals.ts` y `settlement.ts` NO requieren ningún cambio de
código: ya suman `lineTotal` por fila sin importar su `kind`.

#### Scenario: Vender un combo genera 1 header + N componentes

- GIVEN `Combo Familiar` (price 800) con componentes `[{A, qty:2}, {B, qty:1}, {C, qty:2}]`
- WHEN se agrega 1 unidad del combo a la comanda
- THEN se crean 4 filas en `restaurant_order_items`: 1 header (`lineTotal=800`) + 3
  componentes (`lineTotal=0` cada una, `quantity` 2/1/2 respectivamente)
- AND `recomputeTotals` calcula el subtotal de la orden sumando 800 + 0 + 0 + 0 = 800

#### Scenario: Vender 2 unidades del mismo combo multiplica las cantidades de componentes

- GIVEN el mismo combo del escenario anterior
- WHEN se agregan 2 unidades del combo en una sola línea
- THEN el header tiene `quantity=2`, `lineTotal=1600`
- AND las filas componente tienen `quantity` 4/2/4 (componente.quantity × 2)

#### Scenario: Componentes de distintas estaciones rutean a sus propios KDS

- GIVEN "Hamburguesa" rutea a la estación "Cocina" y "Refresco" rutea a "Bar"
- WHEN se vende el combo que incluye ambos
- THEN la fila componente de "Hamburguesa" tiene `stationId` = Cocina
- AND la fila componente de "Refresco" tiene `stationId` = Bar
- AND cada una aparece en la cola del KDS correspondiente de forma independiente

### Requirement: El KDS excluye la fila header — en la cola Y en el estado agregado

El sistema MUST excluir las filas `kind='combo_header'` de `kdsQueue` (RES-4),
independientemente del filtro de estación recibido — el header no tiene `stationId` y NO
representa un plato a preparar, es solo el registro de venta/precio. Solo las filas
`kind='item'` (ítems sueltos) y `kind='combo_component'` MUST aparecer en las colas de
cocina.

**Corrección post-QA (verificado contra `kds.ts` real)**: la exclusión del header NO
alcanza con `kdsQueue` — `recomputeOrderStatus` (mismo archivo, `kds.ts:73-84`) también
itera `deps.lines.findMany({orderId})` filtrando solo `status !== 'cancelled'`, SIN
excluir el header. Si el header nunca es tocado por cocina (queda fuera de `kdsQueue`,
nadie transiciona su `status` desde `'new'`), `recomputeOrderStatus` MUST también excluir
las filas `kind='combo_header'` de ese cálculo — si no, la condición "todas las líneas
activas en `served`" nunca se cumple (el header se queda en `'new'` para siempre) y el
`order.status` agregado queda encallado en `'preparing'` aunque los componentes reales ya
estén todos `served`.

#### Scenario: El header no aparece en ninguna pantalla de cocina

- GIVEN una comanda enviada con un combo (1 header + 2 componentes)
- WHEN la cocina consulta `GET /api/restaurant/kds` sin filtro de estación
- THEN la respuesta incluye las 2 filas componente
- AND NO incluye la fila header, aunque `station` venga vacío ("todas las estaciones")

#### Scenario: El estado agregado de la orden no queda encallado por el header

- GIVEN un combo con 2 filas componente, ambas en estado `served`, y su fila header en
  `new` (nunca transicionada, porque el header no aparece en ningún KDS)
- WHEN `recomputeOrderStatus` calcula el estado agregado de la orden
- THEN el header se excluye del cálculo (igual criterio que `kdsQueue`)
- AND la orden pasa a `served` porque todas las líneas QUE CUENTAN ya están `served`

#### Scenario: El estado del combo se deriva de sus componentes (vista de mesero)

- GIVEN un combo con 2 filas componente, ambas en estado `served`
- WHEN el mesero consulta el detalle de la comanda
- THEN el frontend muestra el combo como "Servido" derivando el estado de sus
  componentes (agregación de UI; el header no participa en las transiciones del KDS)

### Requirement: Edición y baja de una línea de combo es atómica sobre el grupo completo

`updateLine`/`removeLine` sobre una fila `combo_header` MUST propagarse a sus filas
`combo_component` (mismo `parentLineId`): cambiar la cantidad del combo recalcula la
cantidad de TODOS los componentes; quitar el combo borra el header Y sus componentes en
la misma operación. Editar o quitar una fila `combo_component` DIRECTAMENTE (sin pasar
por su header) MUST rechazarse — el componente no es una línea independiente vendible.

#### Scenario: Cambiar la cantidad del combo actualiza sus componentes

- GIVEN un combo vendido con `quantity=1` (componentes con qty base 2/1/2)
- WHEN se actualiza la línea header a `quantity=3`
- THEN el header pasa a `lineTotal = price × 3`
- AND las filas componente pasan a `quantity` 6/3/6

#### Scenario: Quitar el combo quita también sus componentes

- GIVEN un combo vendido (header + 3 componentes)
- WHEN se hace `DELETE` sobre la línea header
- THEN las 4 filas (header + 3 componentes) se eliminan de la comanda
- AND `recomputeTotals` recalcula la orden sin ese monto

#### Scenario: No se puede editar un componente directamente

- GIVEN una fila `combo_component` con `parentLineId` no nulo
- WHEN se intenta `PUT /api/restaurant/orders/:id/items/:lineId` sobre esa fila
- THEN el sistema responde 400 ("Esta línea pertenece a un combo; editá el combo completo")

### Requirement: Consumo de inventario por componente (sin cambios en el conector)

Al liquidarse la comanda (`onOrderPaid`/`onOrderCharged`), el descuento de stock de cada
componente del combo MUST ocurrir exactamente igual que el de un ítem vendido suelto: el
conector `restaurante-inventario` itera `full.lines` (que ahora incluye las filas
`combo_component`, cada una con su propio `menuItemId` y `quantity` ya multiplicada) y
llama `consumeForSale({ menuItemId, soldQty: quantity, lineId })` por cada una — SIN
ninguna rama nueva de código para "combo". La fila header (`menuItemId=null`) se salta
sola por el chequeo existente `if (!l.menuItemId ...) continue`.

#### Scenario: Vender un combo descuenta el stock de cada componente

- GIVEN el combo del primer escenario (2× Hamburguesa, 1× Papas, 2× Refresco) con receta
  definida para cada ítem componente
- WHEN se cobra la comanda (`payOrder`)
- THEN el conector descuenta insumos por Hamburguesa×2, Papas×1, Refresco×2, cada uno
  con su propio `sourceId={componentLineId}:{inventoryItemId}` (dedup ya existente,
  sin colisión entre componentes porque cada uno tiene su propio `lineId`)

#### Scenario: Un componente sin receta no bloquea el resto

- GIVEN "Refresco" sin receta definida (stock fantasma)
- WHEN se cobra la comanda
- THEN se descuentan los insumos de Hamburguesa y Papas normalmente
- AND se registra el warning de "stock fantasma" para Refresco (comportamiento ya
  existente de `consumeForSale`, sin cambios)

## Database

- **NEW TABLE** `menu_combos`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `id` | string (UUID) | NOT NULL | PK |
  | `hotelId` | string | NOT NULL, indexed | multi-tenant |
  | `name` | string | NOT NULL | |
  | `description` | text | nullable | |
  | `price` | number | NOT NULL | precio propio del combo, neto (misma convención que `menu_items.price`) |
  | `taxRate` | number | nullable | igual criterio que `menu_items.taxRate`: null → tasa del hotel al facturar |
  | `imageUrl` | string | nullable | |
  | `available` | number (0/1) | default `1` | |
  | `sortOrder` | number | default `0` | |
  | `createdAt`/`updatedAt` | string | timestamps ORM | |

- **NEW TABLE** `menu_combo_items`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `id` | string (UUID) | NOT NULL | PK |
  | `hotelId` | string | NOT NULL, indexed | multi-tenant |
  | `comboId` | string | NOT NULL, indexed | FK lógica a `menu_combos.id` |
  | `menuItemId` | string | NOT NULL, indexed | FK lógica a `menu_items.id`, MISMO hotel |
  | `quantity` | number | NOT NULL, default `1` | unidades del ítem por unidad de combo |
  | `sortOrder` | number | default `0` | orden de despliegue del componente en la UI |
  | `createdAt`/`updatedAt` | string | timestamps ORM | |

- **MODIFIED TABLE** `restaurant_order_items` (compartida con F1; columnas acumulativas)
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `kind` | string | default `'item'` | `'item'` \| `'combo_header'` \| `'combo_component'` |
  | `comboId` | string | nullable, indexed | solo en filas `combo_header`: FK lógica a `menu_combos.id` |
  | `parentLineId` | string | nullable, indexed | solo en filas `combo_component`: FK lógica (self) a la fila `combo_header` |

  Retrocompatibilidad: las filas existentes (pre-F2) no tienen `kind` — el `ADD COLUMN`
  con `default:'item'` (ver regla de `ormMigrate` en `CLAUDE.md`, sección Portabilidad
  Postgres) las trata igual que un ítem simple, sin migración de datos manual.

## API

Rutas de catálogo bajo el mismo criterio de permisos que ítems/categorías
(`restaurant:view` lectura, `restaurant-catalog:*` mutación):

| Método | Ruta | Permiso | Body |
|---|---|---|---|
| GET | `/api/restaurant/combos` | `restaurant:view` | — |
| GET | `/api/restaurant/combos/:id` | `restaurant:view` | — |
| POST | `/api/restaurant/combos` | `restaurant-catalog:create` | `{ name, description?, price, taxRate?, imageUrl?, available?, sortOrder?, items: [{ menuItemId, quantity, sortOrder? }] }` |
| PUT | `/api/restaurant/combos/:id` | `restaurant-catalog:edit` | idem, parcial (reemplaza `items` completo si viene) |
| DELETE | `/api/restaurant/combos/:id` | `restaurant-catalog:delete` | — |

Ownership: `findById`/`findOne` de combo y de cada `menuItemId` referenciado MUST validar
`hotelId` con `auth.assertOwnership(...)`, igual patrón que `items-crud.ts`.

`POST /api/restaurant/orders/:id/items` (existente) se EXTIENDE para aceptar combos:

```
AddLineSchema += { comboId?: string }   // mutuamente excluyente con menuItemId
```

**Corrección post-QA (verificado contra `validators/schema.ts:85` real)**: `AddLineSchema`
hoy declara `menuItemId: { required: true }`. `validateSchema` corre en `controller.ts`
ANTES de llegar al usecase — un request con solo `comboId` (sin `menuItemId`) sería
rechazado por el schema con 400 antes de que el usecase `addLine` llegue siquiera a
evaluar "exactamente uno de menuItemId o comboId". Este spec EXIGE que `AddLineSchema`
cambie `menuItemId` de `required: true` a **condicional**: el schema-level valida solo que
el campo sea string si viene; la regla real "exactamente uno de los dos, nunca ambos,
nunca ninguno" la sigue enforzando el usecase `addLine` (el validator no puede expresar
XOR entre dos campos).

El usecase `addLine` MUST validar que viene EXACTAMENTE uno de `menuItemId` o `comboId`
(nunca ambos, nunca ninguno) y, si es `comboId`, ejecutar la descomposición
header+componentes descripta arriba dentro de la MISMA transacción lógica que crea la
línea (si la creación de un componente falla, ninguna fila del combo queda persistida).

`showOrder`/`getOrder` (sin cambios de firma) ya devuelve todas las filas de
`restaurant_order_items` de la orden — el frontend agrupa por `parentLineId` para
mostrar el combo como una unidad visual.

## UI

- Nueva pestaña "Combos" en Carta (`carta.vue`): alta/edición de combos, selector
  multi-ítem con cantidad por componente (reusa `SectionCard`/`AppModal`).
- En Comanda (`comanda.vue`), los combos aparecen listados junto a los ítems sueltos
  (badge "Combo"); al agregarlos se muestra una sola línea "Combo Familiar × 1 — $800"
  con los componentes desplegables debajo (solo informativo, no editables por separado).
- El ticket del KDS agrupa visualmente los componentes de un mismo combo bajo un
  encabezado "de: Combo Familiar" para que la cocina entienda que van juntos, aunque
  cada componente se marque `preparing`/`ready`/`served` de forma independiente.
- Food cost (F3) del combo se calcula como la suma del costo de receta de sus
  componentes × cantidad — ver `menu-food-cost/spec.md`.
