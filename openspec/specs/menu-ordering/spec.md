# Menu Ordering Specification (F8)

## Purpose

Reemplazar el campo numérico `sortOrder` (hoy un `<input type="number">` que el admin
escribe a mano — `carta.vue:92,105,128,141,170,195`) por arrastrar-y-soltar para
reordenar categorías e ítems dentro de su categoría. Dominio 100% FRONTEND: no hay tabla,
columna, ni endpoint nuevo — `sortOrder` YA existe en `menu_categories`/`menu_items`
(`model.ts:30,52`) y ya se persiste vía `PUT /api/restaurant/categories/:id` /
`PUT /api/restaurant/menu-items/:id` (`UpdateCategorySchema`/`UpdateItemSchema`, ambos ya
aceptan `sortOrder: { type: 'number' }` — `validators/schema.ts:25-30,44-54`). Este spec
NO agrega ningún schema, ruta, ni usecase nuevo — solo cambia CÓMO el frontend arma el
valor de `sortOrder` que manda a esos dos endpoints, que YA existen y no se tocan.

**Precedente real de drag-and-drop en este código**: no hay ninguna librería de
drag-and-drop en `frontend/package.json` (sin `vuedraggable`/`sortablejs`/similar). El
patrón YA usado en 3 pantallas del proyecto (`pages/housekeeping/index.vue`,
`pages/maintenance/index.vue`, `components/features/dashboard/ReservationsGantt.vue`,
confirmado por `grep 'draggable=\"true\"'`) es HTML5 Drag and Drop API nativo
(`draggable="true"`, `@dragstart`, `@dragover.prevent`, `@drop.prevent`) sin dependencias
nuevas. Este spec sigue el mismo patrón — no introduce una librería nueva para esto.

## Requirements

### Requirement: Reordenar ítems dentro de una categoría por arrastre

El sistema MUST permitir arrastrar un ítem de la carta a una nueva posición DENTRO de su
misma categoría (no reordenar en un solo drag entre categorías distintas — mover de
categoría sigue siendo el campo `categoryId` del formulario de edición, sin cambios). Al
soltar, el frontend MUST recalcular el `sortOrder` de los ítems afectados y persistirlo
vía `PUT /api/restaurant/menu-items/:id` para cada uno que cambió.

#### Scenario: Mover un ítem al principio de su categoría

- GIVEN "Entradas" con ítems `[A(0), B(1), C(2)]` (sortOrder entre paréntesis)
- WHEN el admin arrastra `C` a la primera posición
- THEN el frontend recalcula `[C(0), A(1), B(2)]`
- AND manda `PUT` a los 3 ítems cuyo `sortOrder` cambió (A, B, C — los 3, porque los 3
  corrieron de posición)

#### Scenario: Mover un ítem una sola posición no reescribe toda la categoría

- GIVEN `[A(0), B(1), C(2), D(3)]`
- WHEN se arrastra `B` a la posición de `C` (intercambian lugar)
- THEN solo `B` y `C` cambian de `sortOrder` — el frontend MUST comparar el orden nuevo
  contra el viejo y mandar `PUT` solo a los ítems cuyo `sortOrder` efectivamente cambió,
  no a la categoría entera en cada drag (evita N requests innecesarios en una categoría
  larga)

### Requirement: Reordenar categorías por arrastre

El sistema MUST permitir arrastrar una categoría completa a una nueva posición en la
lista de categorías del hotel, con el mismo mecanismo de recálculo + `PUT` selectivo
sobre `/api/restaurant/categories/:id`.

#### Scenario: Reordenar categorías

- GIVEN `[Entradas(0), Platos fuertes(1), Postres(2)]`
- WHEN el admin arrastra "Postres" al medio
- THEN el nuevo orden persiste como `[Entradas(0), Postres(1), Platos fuertes(2)]`

### Requirement: Fallo de red no deja el orden visual desincronizado del servidor

Si algún `PUT` de los disparados por un drag falla, el sistema MUST revertir el orden
visual al último estado confirmado por el servidor (no dejar que la UI muestre un orden
que no se guardó) y mostrar un error — mismo criterio de consistencia que ya usa el
proyecto en otras pantallas con "cambios sin guardar" (`settings/index.vue`, patrón
`markClean()`/snapshot).

#### Scenario: El servidor rechaza uno de los PUT de un reorder de 3 ítems

- GIVEN un drag que dispara 3 `PUT` (A, B, C)
- WHEN el `PUT` de `B` falla (ej. red caída)
- THEN el frontend revierte la lista completa al orden que tenía ANTES del drag (vuelve a
  pedir `GET /api/restaurant/menu-items` o restaura el snapshot previo) y muestra un toast
  de error — nunca deja A y C con el nuevo orden y B con el viejo (estado inconsistente
  invisible para el admin)

### Requirement: El campo numérico se retira de la UI, no del modelo

El formulario de alta/edición de categoría/ítem MUST dejar de mostrar el campo "Orden"
como `<input type="number">` (líneas 92, 105, 128, 141, 170, 195 de `carta.vue`) — el
reorder pasa a ser exclusivamente por arrastre en la lista. El campo `sortOrder` en el
modelo/schema/backend NO se toca: sigue siendo un `number` común, el frontend simplemente
deja de exponer un input manual para escribirlo.

#### Scenario: Crear un ítem nuevo sin campo de orden visible

- GIVEN el admin abre "Nuevo ítem"
- WHEN completa el formulario
- THEN no ve ningún campo "Orden" — el ítem nuevo se crea con `sortOrder` calculado
  automáticamente como "al final de su categoría" (`max(sortOrder existente) + 1`, o `0`
  si la categoría está vacía), sin que el admin tenga que decidir un número

## Database

Ninguna tabla ni columna nueva ni modificada. `menu_categories.sortOrder` y
`menu_items.sortOrder` ya existen (`model.ts:30,52`) desde `restaurante-pos` (RES-0/RES-1).

## API

Ninguna ruta nueva. Se reusan, sin modificar su schema ni su firma:

| Método | Ruta | Uso en F8 |
|---|---|---|
| PUT | `/api/restaurant/categories/:id` | `{ sortOrder }` por cada categoría que cambió de posición |
| PUT | `/api/restaurant/menu-items/:id` | `{ sortOrder }` por cada ítem que cambió de posición dentro de su categoría |

No hay endpoint de reorder "en bloque" — no existe ningún precedente de PATCH/PUT masivo
en el codebase (verificado: la única pantalla con drag-and-drop existente,
`maintenance/index.vue`, también persiste con un `update()` individual por drop, no un
endpoint de bulk). Introducir uno sería alcance nuevo no pedido por el `proposal.md`
("F8 es puramente frontend... reusa los endpoints ya existentes").

## UI

- En `carta.vue`, las filas de categorías y de ítems (dentro de su categoría activa)
  agregan `draggable="true"` + `@dragstart`/`@dragover.prevent`/`@drop.prevent`, mismo
  patrón ya usado en `maintenance/index.vue:70-96`, con un handle visual (ícono `⋮⋮`) para
  indicar que la fila se puede arrastrar — sin el handle, el click accidental sobre
  "Editar"/"Eliminar" podría iniciar un drag por error.
- Mientras se arrastra, la fila arrastrada se muestra semi-transparente
  (`opacity-50`, mismo estilo que `maintenance/index.vue:97`) y la posición de destino se
  resalta.
- El campo "Orden" desaparece de los modales `FormModal` de categoría/ítem
  (`carta.vue:92,105,128,141,170,195` — se eliminan esas entradas de `fields`).
- Un toast confirma "Orden actualizado" al soltar exitosamente; un toast de error +
  reversión visual si algún `PUT` falla (ver requirement de arriba).
