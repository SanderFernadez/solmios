# Menu Allergens Specification (F5)

## Purpose

Permitir marcar cada ítem de la carta con tags de alérgenos/información dietética
(gluten, lactosa, mariscos, frutos secos, picante, vegano, vegetariano, etc.) para que se
muestren en Carta y en la carta pública (F7). Dominio NUEVO — una columna nullable en
`menu_items`, sin tabla nueva (consistente con el resto de F4-F6: el `proposal.md` los
agrupa como "columnas nuevas nullable").

**Decisión de diseño (catálogo fijo, no administrable)**: el `proposal.md` dice "tags
configurables ... por ítem", que se puede leer de dos formas: (a) el admin elige QUÉ tags
aplican a CADA ítem (configurable por ítem), o (b) el admin puede además INVENTAR tags
nuevos con gobernanza propia (catálogo administrable con tabla y validación server-side).
Este spec toma la lectura (a): un catálogo FIJO de tags comunes definido en código (mismo
patrón que los enums existentes del módulo — `OrderType`, `LineStatus` en `types.ts:3,6`,
`TABLE_STATUSES` en `validators/schema.ts:60`), y el admin elige cuáles aplican a cada
ítem.

**Corrección post-QA**: la comparación original citaba `modules/amenities/` como ejemplo
de "catálogo administrable" — verificado contra el código real (`shared/models.ts:137-158`,
`amenities/service.ts`), `amenityKey` es un string libre sin whitelist ni enum server-side;
no hay gobernanza real, solo texto sin validar. No es un contraejemplo válido de catálogo
administrado. La decisión de F5 (catálogo fijo en código) se sostiene igual, pero por una
razón distinta a la citada: un catálogo administrable con tabla propia y validación real
sería trabajo nuevo no justificado por el alcance (alérgenos son una lista relativamente
estándar, no algo que cada hotel necesite personalizar con nombres propios), y además
contradice "sin tabla nueva" que el proposal fija para F4-F6.

## Requirements

### Requirement: Catálogo fijo de tags

El sistema MUST definir un catálogo fijo de tags (backend, ej.
`ALLERGEN_TAGS = ['gluten', 'lactose', 'nuts', 'shellfish', 'egg', 'soy', 'spicy',
'vegan', 'vegetarian', 'gluten_free']`, en inglés — DB/código en inglés, la UI traduce
cada key a su etiqueta en español) y validar que `menu_items.allergens` solo contenga
valores de ese catálogo.

#### Scenario: Guardar tags válidos

- GIVEN "Curry picante" del hotel
- WHEN el admin guarda `allergens: ['spicy', 'lactose']`
- THEN el ítem queda con esos 2 tags

#### Scenario: Tag fuera del catálogo se rechaza

- GIVEN un intento de guardar `allergens: ['gluten', 'invented_tag']`
- WHEN se envía al backend
- THEN el sistema responde 400 (`"invented_tag" no es un alérgeno/tag válido`) y el ítem
  NO se actualiza

### Requirement: Alérgenos son informativos, no bloquean venta

Los tags de alérgenos NUNCA MUST bloquear que un ítem se agregue a una comanda — no son
una regla de negocio como `available`, son información para que el mesero/huésped decida.
Esto es intencional: a diferencia de F1 (modificadores `required`) o F6 (disponibilidad
por horario), acá no hay ningún `ValidationError` posible en `addLine`.

#### Scenario: Ítem con alérgenos se agrega a la comanda sin fricción

- GIVEN "Curry picante" con `allergens: ['spicy', 'nuts']`
- WHEN el mesero lo agrega a una comanda
- THEN la línea se crea exactamente igual que hoy, sin ningún chequeo adicional

### Requirement: Alérgenos de un combo se derivan de sus componentes, nunca se cargan a mano

Si F2 está aplicado, un combo NUNCA MUST tener su propio campo `allergens` editable — sus
alérgenos son la UNIÓN de los alérgenos de TODOS sus `menu_combo_items.menuItemId`,
calculada al leer, no guardada. La razón: un campo editable a mano en el combo puede
quedar desactualizado si después se cambia un componente (ej. se reemplaza "Papas" por
"Papas con queso", que agrega lactosa) — el combo mostraría "sin lactosa" siendo falso.
Es el mismo tipo de riesgo que ya evita `hasRecipe`/`menuItemsWithRecipe`: derivar en vez
de duplicar datos que se desincronizan.

#### Scenario: Cambiar un componente actualiza los alérgenos del combo automáticamente

- GIVEN `Combo Familiar` cuyos componentes no tienen lactosa
- WHEN el admin reemplaza un componente por uno con `allergens: ['lactose']`
- THEN la próxima vez que se lee el combo, sus alérgenos derivados incluyen `'lactose'`
  sin que nadie haya tocado el combo directamente

#### Scenario: Un componente sin alérgenos declarados no aporta falsos negativos

- GIVEN un combo con un componente sin `allergens` (nunca configurado, `null`)
- WHEN se calculan los alérgenos derivados del combo
- THEN ese componente simplemente no aporta tags — el combo no se marca "sin alérgenos"
  de forma incorrecta, solo refleja lo que SÍ está declarado (limitación conocida: un tag
  no cargado en un ítem no aparece en el combo; es la misma limitación que ya existe a
  nivel ítem individual, no una regresión)

## Database

- **MODIFIED TABLE** `menu_items`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `allergens` | json (array) | nullable | array de strings del catálogo fijo. `null`/ausente = sin tags declarados (compat retro) |

  `menu_combos` NO recibe columna `allergens` — se deriva en el usecase de lectura, nunca
  se persiste (ver requirement de arriba).

## API

`CreateItemSchema`/`UpdateItemSchema` se EXTIENDEN:

```
allergens?: string[]   // type: 'array', validado contra ALLERGEN_TAGS en el usecase
```

El usecase `createItem`/`updateItem` (`items-crud.ts`) MUST validar cada elemento contra
el catálogo fijo (`assertAllergens`, mismo estilo que `assertPrice`/`assertTaxRate` ya
existentes en ese archivo) y rechazar con `ValidationError` ante cualquier valor
desconocido.

`GET /api/restaurant/menu-items`, `/menu-items/:id` devuelven `allergens` tal cual (sin
transformación). `GET /api/restaurant/combos/:id` (si F2 aplica) agrega un campo
`allergens` CALCULADO (unión de componentes), NO persistido — el schema de combo
(`CreateComboSchema`/`UpdateComboSchema`) NO acepta `allergens` en el body; si llega, se
descarta en silencio por el whitelist de `validateSchema` (mismo mecanismo documentado en
mem 1805 que protege cualquier campo no declarado).

## UI

- En el editor de ítem (`carta.vue`), un multi-select de checkboxes con el catálogo fijo,
  cada uno con su ícono/etiqueta en español (ej. 🌾 Gluten, 🥛 Lactosa, 🥜 Frutos secos,
  🦐 Mariscos, 🌶️ Picante, 🌱 Vegano, 🥕 Vegetariano).
- En la lista de ítems de Carta, tags como badges pequeños junto al nombre (mismo patrón
  visual que el badge "Agotado"/"Sin receta" ya existentes en `carta.vue:365-366`).
- En Comanda y en la carta pública (F7), los tags se muestran igual, como información para
  decidir, nunca como bloqueo.
- El combo muestra sus alérgenos derivados con la etiqueta "Contiene (según sus
  componentes):" para dejar explícito que es un cálculo, no una declaración directa del
  combo.
