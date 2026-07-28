# Menu Modifiers Specification (F1)

## Purpose

Permitir que un ítem de la carta (`menu_items`) tenga grupos de opciones configurables
("Tamaño": chico/grande, "Extras": +queso/+tocino) que ajustan el precio de la línea y,
opcionalmente, consumen un insumo propio de inventario. Es dominio NUEVO — no existe spec
previa para modificadores; este documento es la especificación COMPLETA (no delta).

Este dominio es dueño de dos tablas nuevas (`menu_item_modifier_groups`,
`menu_item_modifiers`) y de un ADDED requirement sobre `restaurant_order_items` (columna
`modifiers`) y sobre el conector `restaurante-inventario` (consumo opcional por modificador).

**Decisión cruzada con F2 (`menu-combos/spec.md`), tomada en `design.md`**: los
modificadores de este spec aplican SOLO a líneas de ítem suelto (`kind='item'`, `menuItemId`
presente). Elegir un modificador dentro de un componente de combo (`kind='combo_component'`)
está PROHIBIDO en esta v1 — el usecase `addLine` MUST rechazar (`ValidationError`, 400) un
request que traiga `comboId` junto con cualquier campo de modificadores. Razón: el precio
del combo vive solo en el header (`unitPrice=0`/`lineTotal=0` en todo componente, ver F2);
permitir un modificador con `priceDelta≠0` sobre un componente no tiene dónde aterrizar sin
código nuevo de validación cruzada, que es superficie de riesgo evitable (hueco de precio
si esa validación tuviera un bug). Si se necesita personalizar componentes de combo, es una
fase F9 futura con su propia spec, no una extensión implícita de este documento.

## Requirements

### Requirement: Grupos de modificadores por ítem

El sistema MUST permitir definir, por `menuItemId`, uno o más grupos de opciones
(`menu_item_modifier_groups`), cada uno con un `selectionType` (`single` = radio,
`multiple` = checkbox) y un flag `required`. Un grupo `required=true` con
`selectionType='single'` MUST tener exactamente una opción seleccionada al agregar la
línea; un grupo `required=true` con `selectionType='multiple'` MUST tener al menos
`minSelect` opciones (default 1).

#### Scenario: Crear un grupo "Tamaño" de selección única y obligatoria

- GIVEN un ítem "Hamburguesa" del hotel
- WHEN el admin crea un grupo `{ name: "Tamaño", selectionType: "single", required: true }`
  con opciones "Chico" (priceDelta 0) y "Grande" (priceDelta 50)
- THEN el grupo queda asociado al ítem
- AND el POS exige elegir una de las dos opciones antes de agregar la línea

#### Scenario: Grupo opcional de selección múltiple

- GIVEN un grupo "Extras" `{ selectionType: "multiple", required: false }` con opciones
  "+queso" (priceDelta 50) y "+tocino" (priceDelta 80)
- WHEN el mesero agrega la línea sin elegir ningún extra
- THEN la línea se crea sin extras y sin ajuste de precio por este grupo

#### Scenario: Grupo requerido sin selección se rechaza

- GIVEN el grupo "Tamaño" (`required: true`, `selectionType: 'single'`)
- WHEN se intenta agregar la línea sin elegir una opción del grupo
- THEN el sistema responde 400 con un mensaje que identifica el grupo faltante
- AND la línea NO se crea

### Requirement: Opciones con impacto en precio

Cada opción (`menu_item_modifiers`) MUST tener un `priceDelta` (puede ser negativo, ej.
"sin papas" con descuento) que se SUMA al `unitPrice` base del ítem para calcular el
`lineTotal` de la línea. El sistema MUST recalcular `lineTotal = (unitPrice + Σ
priceDelta de las opciones elegidas) × quantity`, redondeado a 2 decimales
(`round2`, igual convención que `order-totals.ts`).

#### Scenario: Precio final refleja el modificador

- GIVEN "Hamburguesa" con `price=250` y opción "Grande" con `priceDelta=50`
- WHEN se agrega la línea con cantidad 2 y la opción "Grande" seleccionada
- THEN `unitPrice` snapshot = 250, `modifiers` snapshot incluye `{ name: "Grande",
  priceDelta: 50 }`
- AND `lineTotal = (250 + 50) × 2 = 600`

#### Scenario: Modificador con descuento (priceDelta negativo)

- GIVEN una opción "Sin papas" con `priceDelta=-30`
- WHEN se agrega la línea con esa opción
- THEN el `lineTotal` de la línea se reduce en 30 × quantity respecto del precio base

### Requirement: Snapshot de modificadores en la línea de comanda

El sistema MUST snapshotear las opciones elegidas en la propia fila de
`restaurant_order_items` (columna `modifiers`, JSON), NO como filas adicionales. Esto
preserva el invariante ya existente: una línea de comanda = una fila con un solo
`lineTotal`, y `order-totals.ts`/`settlement.ts` siguen sumando `lineTotal` por fila SIN
NINGÚN cambio de código en esos dos archivos.

El snapshot MUST incluir, por cada opción elegida: `groupId`, `groupName`, `modifierId`,
`name`, `priceDelta` — igual que el resto de la línea (name/unitPrice/taxRate), la
comanda NO debe mutar si el admin edita o borra el modificador después.

#### Scenario: Editar el modificador después de vendido no cambia comandas viejas

- GIVEN una línea de comanda ya creada con el modificador "Grande" (`priceDelta=50`)
- WHEN el admin cambia el `priceDelta` de "Grande" a 70 en la carta
- THEN la línea de comanda ya existente conserva `priceDelta: 50` en su snapshot
- AND su `lineTotal` no cambia retroactivamente

#### Scenario: Borrar el modificador después de vendido no rompe la comanda

- GIVEN una línea de comanda con el modificador "Grande" snapshoteado
- WHEN el admin borra la opción "Grande" de la carta
- THEN la línea de comanda conserva el nombre y el ajuste de precio en su snapshot
- AND el ticket del KDS sigue mostrando "Grande" en la descripción de la línea

### Requirement: Consumo de inventario opcional por modificador

Una opción MAY declarar su propio consumo de insumo (`inventoryItemId` +
`inventoryQuantity`, mismo patrón que `menu_item_recipes`). Cuando la comanda se liquida
(`onOrderPaid`/`onOrderCharged`), el sistema MUST descontar, además del insumo de la
receta base del ítem, el insumo declarado por cada modificador elegido en el snapshot de
la línea (best-effort, igual criterio que `consumeForSale`: un fallo de descuento NUNCA
rompe el cobro).

**Nota de implementación (post-QA)**: el conector `restaurante-inventario.ts` hoy es un
loop puro (`for line of lines: consumeForSale(...)`) sin parseo de sub-estructuras — regla
del proyecto "connector solo DELEGA vía sockets". Parsear el JSON `modifiers` de la línea
para extraer los `inventoryItemId`/`inventoryQuantity` de cada opción elegida NO debe
implementarse inline en el conector: ese parseo MUST vivir en el módulo `inventario`
(ej. una función `consumeForSaleWithModifiers` en `usecases/recipes.ts` que reciba la línea
completa y haga ella misma el `for` sobre `line.modifiers`), y el conector se limita a
invocar esa función — igual que hoy invoca `consumeForSale` sin conocer el detalle de la
receta.

El `sourceId` del movimiento de stock por modificador MUST ser distinto del `sourceId`
del insumo de receta base (`${lineId}:${modifierId}:${inventoryItemId}`) para no
colisionar con la dedup existente (`${lineId}:${inventoryItemId}`) y mantener
idempotencia independiente.

#### Scenario: Modificador con receta propia descuenta insumo extra

- GIVEN "Hamburguesa" con receta base (pan, carne) y la opción "+tocino" con
  `inventoryItemId` = "Tocino" y `inventoryQuantity` = 2 unidades
- WHEN se cobra una comanda con esa línea (quantity 1, "+tocino" elegido)
- THEN se descuentan los insumos de la receta base del ítem (como hoy)
- AND se descuentan 2 unidades de "Tocino" con `source='pos_sale'`,
  `sourceId='{lineId}:{modifierId}:{inventoryItemId}'`

#### Scenario: Modificador sin insumo declarado no descuenta nada extra

- GIVEN la opción "Grande" sin `inventoryItemId`
- WHEN se cobra la comanda
- THEN solo se descuenta el insumo de la receta base del ítem, sin movimiento adicional

#### Scenario: Reintentar la liquidación no duplica el descuento del modificador

- GIVEN una línea ya liquidada cuyo modificador ya generó su movimiento de stock
- WHEN el evento `onOrderPaid` se procesa dos veces para la misma comanda (reintento)
- THEN el segundo intento no duplica el movimiento (dedup por `source`+`sourceId`)

## Database

- **NEW TABLE** `menu_item_modifier_groups`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `id` | string (UUID) | NOT NULL | PK |
  | `hotelId` | string | NOT NULL, indexed | multi-tenant |
  | `menuItemId` | string | NOT NULL, indexed | FK lógica a `menu_items.id` |
  | `name` | string | NOT NULL | ej. "Tamaño" |
  | `selectionType` | string | NOT NULL, default `'single'` | `single` \| `multiple` |
  | `required` | number (0/1) | default `0` | booleano como INTEGER |
  | `minSelect` | number | default `1` | solo aplica si `selectionType='multiple'` |
  | `maxSelect` | number | nullable | `null` = sin tope |
  | `sortOrder` | number | default `0` | |
  | `createdAt`/`updatedAt` | string | timestamps ORM | |

- **NEW TABLE** `menu_item_modifiers`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `id` | string (UUID) | NOT NULL | PK |
  | `hotelId` | string | NOT NULL, indexed | multi-tenant |
  | `groupId` | string | NOT NULL, indexed | FK lógica a `menu_item_modifier_groups.id` |
  | `name` | string | NOT NULL | ej. "Grande", "+tocino" |
  | `priceDelta` | number | NOT NULL, default `0` | puede ser negativo |
  | `inventoryItemId` | string | nullable, indexed | FK lógica a `inventory_items.id` (owned por módulo `inventario`) |
  | `inventoryQuantity` | number | nullable | consumo por unidad vendida con esta opción elegida |
  | `active` | number (0/1) | default `1` | |
  | `sortOrder` | number | default `0` | |
  | `createdAt`/`updatedAt` | string | timestamps ORM | |

- **MODIFIED TABLE** `restaurant_order_items` (owned por `restaurant`, NO se re-declara en `inventario`)
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `modifiers` | string (JSON) | nullable | snapshot `[{ groupId, groupName, modifierId, name, priceDelta }]`. `null`/ausente = sin modificadores (compat retro con líneas viejas) |

  No se agregan filas nuevas a `restaurant_order_items` por modificador — es una columna
  en la MISMA fila de la línea, no una sub-línea. Esto es una corrección respecto del texto
  del `proposal.md` (que hablaba de "sub-línea con su propio lineTotal"): con el snapshot
  en la misma fila, `order-totals.ts` y `settlement.ts` no requieren NINGÚN cambio.

## API

Todas las rutas nuevas van bajo `/api/restaurant/menu-items/:menuItemId/modifier-groups`,
protegidas igual que el resto del catálogo de Carta: `auth.authenticate(...)` +
`requirePermission('restaurant-catalog', action)` (mutación) / `requirePermission('restaurant', 'view')`
(lectura) — mismo criterio ya usado en `index.ts` para categorías/ítems (lectura operativa
para el mesero, mutación reservada a quien administra la carta).

| Método | Ruta | Permiso | Body/Query |
|---|---|---|---|
| GET | `/api/restaurant/menu-items/:menuItemId/modifier-groups` | `restaurant:view` | — |
| POST | `/api/restaurant/menu-items/:menuItemId/modifier-groups` | `restaurant-catalog:create` | `{ name, selectionType, required?, minSelect?, maxSelect?, sortOrder? }` |
| PUT | `/api/restaurant/modifier-groups/:id` | `restaurant-catalog:edit` | idem, parcial |
| DELETE | `/api/restaurant/modifier-groups/:id` | `restaurant-catalog:delete` | — (cascada: borra sus opciones) |
| POST | `/api/restaurant/modifier-groups/:groupId/modifiers` | `restaurant-catalog:create` | `{ name, priceDelta, inventoryItemId?, inventoryQuantity?, active?, sortOrder? }` |
| PUT | `/api/restaurant/modifiers/:id` | `restaurant-catalog:edit` | idem, parcial |
| DELETE | `/api/restaurant/modifiers/:id` | `restaurant-catalog:delete` | — |

Ownership: todo `findById` de grupo/opción MUST validar `hotelId` contra
`auth.assertOwnership(...)` (mismo patrón que `items-crud.ts`). `groupId`/`menuItemId`
referenciados MUST resolverse por `findOne({ id })` + chequeo de `hotelId` (igual criterio
que `assertCategory`/`assertStation` en `items-crud.ts`), nunca `findById` crudo sin
ownership.

`POST /api/restaurant/orders/:id/items` (existente, `AddLineSchema`) se EXTIENDE:

```
AddLineSchema += { modifiers?: Array<{ modifierId: string }> }  // type: 'array'
```

El usecase `addLine` (`order-lines.ts`) MUST, por cada `modifierId` recibido: resolver la
opción, validar que pertenece a un grupo del `menuItemId` de la línea y al mismo hotel, y
verificar el cumplimiento de `required`/`minSelect`/`maxSelect` de cada grupo del ítem
antes de crear la fila. Un incumplimiento MUST responder `ValidationError` (400) y no
crear la línea.

`GET /api/restaurant/orders/:id` (showOrder) ya devuelve las líneas completas — la columna
`modifiers` viaja tal cual en el DTO, sin transformación adicional.

## UI

- En el editor de un ítem de Carta (`carta.vue`), un ítem nuevo tab/sección
  "Modificadores" permite crear grupos y sus opciones (nombre + ajuste de precio +
  insumo opcional), reusando `AppModal`/`SectionCard`.
- En Comanda (`comanda.vue`), al tocar un ítem con grupos configurados se abre un
  selector (radio para `single`, checkboxes para `multiple`) ANTES de agregar la línea;
  los grupos `required` bloquean el botón "Agregar" hasta completarse.
- La línea agregada en la comanda muestra el nombre del ítem + los modificadores elegidos
  entre paréntesis (ej. "Hamburguesa (Grande, +tocino)") y el precio ya ajustado.
- El ticket del KDS (pantalla de cocina) MUST mostrar los modificadores elegidos junto al
  nombre del plato — la cocina necesita saber "Grande, sin cebolla", no solo "Hamburguesa".
