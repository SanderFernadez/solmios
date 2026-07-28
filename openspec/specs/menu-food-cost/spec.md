# Menu Food Cost Specification (F3)

## Purpose

Mostrarle al dueño el margen real de cada plato (precio de venta − costo de receta) sin
crear ninguna tabla nueva: el dato ya existe repartido en dos módulos — `menu_item_recipes`
(BOM, dueño `inventario`) y `inventory_items.avgCost` (costo promedio ponderado, dueño
`inventario`) contra `menu_items.price` (dueño `restaurant`). Este dominio es SOLO LECTURA:
ningún INSERT/UPDATE nuevo, un usecase que cruza esos tres datos y los expone como reporte.

**Cómo se resuelve el cruce entre módulos (sin violar la regla "no importar de otro
módulo directo")**: el conector `restaurante-inventario.ts` YA inyecta un puerto de
`inventario` hacia `restaurant` para el badge "Sin receta" —
`restaurant.setRecipePorts?.({ menuItemsWithRecipe: ... })` (`connectors/restaurante-inventario.ts:20-22`,
`restaurant/service.ts:23,55-60`). Este spec EXTIENDE ese mismo puerto (no crea uno
paralelo) agregando `getRecipeCost(menuItemId, hotelId)`. El usecase nuevo
`restaurant/usecases/food-cost.ts` llama `recipePorts.getRecipeCost(...)`, nunca importa
`inventario` directo — mismo patrón arquitectónico que el port existente, cero excepciones
nuevas al analyzer.

## Requirements

### Requirement: Costo de receta de un ítem simple

El sistema MUST calcular el costo de receta de un `menuItemId` como
`Σ (recipe.quantity × inventoryItem.avgCost)` sobre todas las filas de
`menu_item_recipes` de ese ítem, vía un nuevo usecase en `inventario`
(`recipeCost(menuItemId, user)`, junto a `recipesUc` en `inventario/service.ts`, mismo
archivo que ya tiene `listRecipes`/`consumeForSale`).

#### Scenario: Ítem con 2 insumos en su receta

- GIVEN "Hamburguesa" con receta `[{ Pan, quantity: 1 }, { Carne, quantity: 0.2 }]`
- AND `Pan.avgCost = 15`, `Carne.avgCost = 200`
- WHEN se pide el costo de receta de "Hamburguesa"
- THEN el resultado es `1×15 + 0.2×200 = 55`

#### Scenario: Ítem sin receta

- GIVEN "Refresco" sin ninguna fila en `menu_item_recipes`
- WHEN se pide su costo de receta
- THEN el resultado es `cost: 0` con `hasRecipe: false` (mismo flag que ya expone
  `menuItemsWithRecipe` para el badge "Sin receta" de `carta.vue:366`) — el reporte NO debe
  mostrar "margen 100%" para un plato sin costear, porque el número sería falso, no real.

### Requirement: El puerto de recetas se extiende, no se reemplaza

El conector `restaurante-inventario.ts` MUST agregar `getRecipeCost` al mismo objeto que
ya inyecta `menuItemsWithRecipe`, y `restaurant/service.ts` MUST guardar ambos en el mismo
`recipePorts` (acumulativo, `setRecipePorts` ya soporta merge parcial vía spread —
`service.ts:60` estilo). Si el módulo `inventario` no está montado (o el conector no
corrió), `recipePorts.getRecipeCost` MUST ser `undefined` y el usecase de food cost MUST
degradar con gracia (`cost: null`, `available: false`), igual criterio que
`menuItemsWithRecipe` hoy cuando el puerto no está seteado (`service.ts` devuelve `[]`).

#### Scenario: Inventario no montado en este hotel

- GIVEN un hotel cuyo plan no incluye el módulo `inventario`
- WHEN se pide el food cost de un ítem de ese hotel
- THEN la respuesta es `{ cost: null, available: false }`, sin error 500
- AND el reporte de food cost lo muestra como "Sin costear" en vez de romper la pantalla

### Requirement: Margen por ítem

El sistema MUST calcular `margin = price - recipeCost` y
`marginPercent = price > 0 ? round2((margin / price) * 100) : null` para cada ítem con
`hasRecipe: true`. Ítems sin receta MUST excluirse del cálculo de margen (no "0% costo").

#### Scenario: Margen de un plato rentable

- GIVEN "Hamburguesa" con `price = 250` y costo de receta `55`
- WHEN se calcula su margen
- THEN `margin = 195`, `marginPercent = 78`

#### Scenario: Plato vendido por debajo de su costo

- GIVEN un ítem con `price = 100` y costo de receta `130`
- WHEN se calcula su margen
- THEN `margin = -30`, `marginPercent = -30` — el sistema NO trunca a 0, un margen
  negativo real es la señal que el dueño necesita ver

### Requirement: Food cost de un combo (F2) = suma ponderada de sus componentes

Tal como quedó referenciado en `menu-combos/spec.md` (sección UI, "Food cost (F3) del
combo se calcula como la suma del costo de receta de sus componentes × cantidad"), el
sistema MUST calcular el costo de un `comboId` como
`Σ (recipeCost(component.menuItemId) × component.quantity)` sobre todas sus filas de
`menu_combo_items`. Esta suma vive en `restaurant` (dueño de `menu_combos`/`menu_combo_items`),
no en `inventario`: por cada componente se llama `recipePorts.getRecipeCost` (el mismo
puerto de arriba, una vez por componente), y `restaurant/usecases/food-cost.ts` acumula el
resultado — `inventario` nunca se entera de que existen combos.

#### Scenario: Combo con 3 componentes, todos costeados

- GIVEN `Combo Familiar` (price 800) con componentes `[{A qty:2, cost 55}, {B qty:1, cost 20},
  {C qty:2, cost 10}]`
- WHEN se calcula el food cost del combo
- THEN `comboCost = 2×55 + 1×20 + 2×10 = 150`
- AND `margin = 800 - 150 = 650`, `marginPercent = 81.25`

#### Scenario: Combo con un componente sin receta — costo incompleto, no invisible

- GIVEN el mismo combo, pero "Refresco" (componente C) no tiene receta cargada
- WHEN se calcula el food cost del combo
- THEN el componente sin receta aporta `0` a la suma (igual criterio que
  `consumeForSale` con "stock fantasma": no descuenta, no rompe, pero tampoco inventa un
  costo)
- AND el resultado MUST incluir `complete: false` — el margen que se muestra en el reporte
  se ve artificialmente alto porque falta costear un componente, y el dueño necesita saber
  que ese número no es definitivo. Sin este flag, un combo con la mitad de sus platos sin
  receta parecería el más rentable de la carta cuando en realidad es el peor medido.

### Requirement: Reporte ordenable por menor margen

El sistema MUST exponer un reporte que liste TODOS los ítems con receta y TODOS los
combos del hotel, cada uno con `price`, `cost`, `margin`, `marginPercent`, `complete`
(siempre `true` para ítems simples; `false` si algún componente del combo no tiene
receta), ordenado por `marginPercent` ascendente por defecto (el caso de uso real: "¿qué
plato me está comiendo el margen?").

#### Scenario: El plato con menor margen aparece primero

- GIVEN tres platos con `marginPercent` 78, -30 y 45
- WHEN se pide el reporte sin parámetros
- THEN el orden de la respuesta es -30, 45, 78

## Database

Ninguna tabla ni columna nueva. Este dominio deriva 100% de columnas ya existentes:
`menu_items.price` (restaurant), `menu_item_recipes.quantity` (inventario),
`inventory_items.avgCost` (inventario), y — si F2 está aplicado — `menu_combos.price` +
`menu_combo_items.quantity` (restaurant).

## API

**Corrección post-QA**: el gate de permisos es `restaurant-catalog:view`, que HOY no
protege ninguna ruta real — `restaurant/index.ts:83-84` gatea `GET /menu-items` (lectura
de precio/disponibilidad) con `restaurant:view`, el mismo permiso que ya tienen mesero y
cocina (`permissions.ts:167,204,213`). `restaurant-catalog:view` existe como string en
`permissions.ts:136` pero sin ninguna ruta que lo use para lectura hoy — es un permiso
NUEVO EN USO, deliberadamente MÁS ESTRICTO que el que protege el precio: mesero y cocina
YA ven el precio de venta (`restaurant:view`) pero NO tienen `restaurant-catalog` en
ningún rol operativo (`permissions.ts:198-213` — solo `hotel_admin`). El costo de receta y
el margen son datos de rentabilidad del negocio, más sensibles que el precio de venta que
el mesero ya ve — de ahí el permiso separado y más restrictivo, no "el mismo".

| Método | Ruta | Permiso | Response |
|---|---|---|---|
| GET | `/api/restaurant/menu-items/:id/food-cost` | `restaurant-catalog:view` | `{ menuItemId, price, cost, hasRecipe, margin, marginPercent }` |
| GET | `/api/restaurant/combos/:id/food-cost` | `restaurant-catalog:view` | `{ comboId, price, cost, complete, margin, marginPercent }` (requiere F2 aplicado) |
| GET | `/api/restaurant/food-cost/report` | `restaurant-catalog:view` | `{ data: [{ id, kind: 'item'\|'combo', name, price, cost, margin, marginPercent, complete, hasRecipe }], total }`, ordenado por `marginPercent` asc |

Ownership: `:id` de `menu-items`/`combos` se resuelve con `findOne({ id })` + chequeo de
`hotelId` (mismo criterio que `assertCategory`/`assertStation` en `items-crud.ts`), nunca
`findById` crudo. El reporte filtra directamente por `hotelId` del JWT, sin parámetro de
`hotelId` en la query (evita que un usuario pida el reporte de otro hotel cambiando un
query param).

## UI

- En `carta.vue`, junto al precio de cada ítem (línea ~373, donde hoy se muestra
  `money(i.price)`), un badge de margen (ej. `78% margen`, verde si > 50%, ámbar si 20-50%,
  rojo si < 20% o negativo) visible SOLO si `editPerm` (mismo gate que "Receta"/"Editar" —
  el mesero no ve este dato en su vista, porque `restaurant-catalog:view` no se lo da el
  guard del backend tampoco).
- Si el ítem no tiene receta (`hasRecipe === false`), el badge de margen NO se muestra —
  ya existe el badge "Sin receta" (línea 366) que cubre ese caso; no duplicar la señal.
- En la pestaña "Combos" (F2), mismo badge, con un ícono de advertencia adicional si
  `complete === false` ("Costo incompleto: 1 componente sin receta").
- Nueva sección "Food cost" en `carta.vue` (o pestaña propia): tabla del reporte completo,
  ordenada por menor margen por defecto, con buscador/filtro por categoría — reusa
  `SectionCard` y el patrón de tabla clara ya establecido (`.tbl-head`, ver
  `admin-card-header-navy-table-light` en memoria del proyecto).
