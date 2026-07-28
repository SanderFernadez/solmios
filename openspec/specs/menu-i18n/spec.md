# Menu i18n Specification (F4)

## Purpose

Permitir nombre/descripción de categorías, ítems y combos en más de un idioma, con
fallback correcto cuando falta la traducción pedida. Dominio NUEVO — columnas nullable
en `menu_categories`/`menu_items` (y `menu_combos` si F2 está aplicado), sin tabla nueva.

**Corrección al `proposal.md`**: dice "fallback al idioma base del hotel", pero
`hotels` (`hoteles/model.ts`) NO tiene ninguna columna de idioma — no existe un "idioma
base configurable por hotel" en ningún lado del código. Lo que SÍ existe, y es el
precedente real a reusar, es la descripción multilingüe del propio hotel
(`hotels.descriptionJson`, `frontend/src/pages/settings/index.vue:1464-1479`): un mapa
`{ [langCode]: texto }` con 12 idiomas soportados y `activeLang` por defecto `'es'`
(hardcodeado, no leído de ninguna config). El "idioma base" de toda la plataforma —
confirmado también por la regla del proyecto "Spanish UI / English DB-API-code"
(`openspec/config.yaml:19`) — es simplemente **español, fijo**, no un valor por-hotel. Este
spec sigue ese mismo criterio: el fallback final SIEMPRE es `menu_items.name`/`description`
(las columnas base, que YA están en español porque toda la carta se carga en español) —
NUNCA una entrada `es` dentro del propio mapa de traducciones, que sería redundante.

**Segunda diferencia con el precedente**: `hotels.descriptionJson` es un `type: 'string'`
serializado a mano (`JSON.stringify`/`JSON.parse` en el propio componente). Los módulos
más nuevos del código (`ai-recepcionista`, `canales`, `bookingengine`, `paquetes` —
`type: 'json'` en sus `model.ts`) usan el tipo nativo `json` del ORM, que serializa/
deserializa solo y además tiene soporte de validación dedicado en
`shared/validators/validate-body.ts` (`case 'json'`, línea 56). Este spec usa `type: 'json'`
nativo, no el patrón viejo de `hotels`.

## Requirements

### Requirement: Traducciones de un ítem por idioma

El sistema MUST permitir guardar, por `menuItemId`, un mapa `translations` (JSON)
`{ [langCode]: { name?: string; description?: string } }`. El mapa NUNCA incluye la
clave `'es'` — el español vive en las columnas base `name`/`description` del ítem, no
duplicado dentro del JSON.

#### Scenario: Agregar traducción al inglés

- GIVEN "Hamburguesa" (`name: "Hamburguesa"`, `description: "Con papas y ensalada"`)
- WHEN el admin guarda `translations: { en: { name: "Burger", description: "With fries
  and salad" } }`
- THEN el ítem queda con su `name`/`description` base sin cambios (español) MÁS el mapa
  de traducciones

#### Scenario: Traducción parcial (solo el nombre)

- GIVEN un ítem sin traducciones
- WHEN se guarda `translations: { en: { name: "Fries" } }` (sin `description`)
- THEN pedir el ítem en `en` devuelve `name: "Fries"` MÁS `description` en español (fallback
  campo por campo, no todo-o-nada — ver siguiente requirement)

### Requirement: Resolución con fallback campo por campo

Al pedir un ítem/categoría en un idioma `lang`, el sistema MUST resolver, POR CAMPO:
`translations[lang]?.[campo] ?? <valor base del campo>`. Si `lang` es `'es'`, no se
consulta `translations` en absoluto — se devuelve directo el valor base (evita una
vuelta redundante y dos fuentes de verdad para español).

#### Scenario: Idioma sin ninguna traducción cargada

- GIVEN "Refresco" sin `translations`
- WHEN se pide la carta en francés (`lang=fr`)
- THEN el nombre/descripción se muestran en español (el valor base), no un string vacío
  ni un error

#### Scenario: Traducción completa

- GIVEN "Hamburguesa" con `translations.en = { name: "Burger", description: "..." }`
- WHEN se pide en `en`
- THEN se devuelve el nombre y la descripción en inglés

#### Scenario: `lang=es` explícito ignora el mapa de traducciones

- GIVEN un ítem con `translations.es` inexistente (nunca se guarda esa clave) pero con
  `translations.en` cargado
- WHEN se pide explícitamente `lang=es`
- THEN se devuelve `name`/`description` base, sin tocar `translations`

### Requirement: Categorías también traducen (solo nombre)

`menu_categories` MUST soportar el mismo `translations` (JSON), pero solo con clave
`name` por idioma — el modelo de categoría no tiene columna `description` (`model.ts:22-34`
confirma que `MenuCategoryModel` solo tiene `name`, no hay campo que traducir además de
ese).

#### Scenario: Traducir el nombre de una categoría

- GIVEN la categoría "Entradas"
- WHEN se guarda `translations: { en: { name: "Appetizers" } }`
- THEN pedir la carta en inglés muestra la categoría como "Appetizers"

### Requirement: Combos (F2) traducen igual que los ítems

Si F2 está aplicado, `menu_combos` MUST soportar el mismo `translations` de nombre +
descripción. Esto EXTIENDE el alcance textual del `proposal.md` (que solo menciona
`menu_items`/`menu_categories`) por una razón concreta: F7 (carta pública) lista ítems
Y combos juntos — si los combos no traducen, un huésped que cambia el idioma de la carta
pública vería los ítems sueltos en inglés y los combos mezclados en español, una
inconsistencia visible en la misma pantalla. Es la misma clase de corrección que hizo
`menu-combos/spec.md` con el conector de inventario: verificar contra el uso real (F7
combinando ambos catálogos) en vez de tomar el texto del proposal al pie de la letra.

#### Scenario: Combo traducido aparece consistente junto a ítems sueltos en la carta pública

- GIVEN `Combo Familiar` con `translations.en = { name: "Family Combo" }` y "Hamburguesa"
  con `translations.en = { name: "Burger" }`, ambos en la misma categoría
- WHEN el huésped ve la carta pública en inglés
- THEN ambos aparecen en inglés, sin ítems mixtos en español

## Database

- **MODIFIED TABLE** `menu_categories`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `translations` | json | nullable | `{ [langCode]: { name: string } }`. `null`/ausente = sin traducciones (compat retro, todas las categorías existentes) |

- **MODIFIED TABLE** `menu_items`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `translations` | json | nullable | `{ [langCode]: { name?: string; description?: string } }` |

- **MODIFIED TABLE** `menu_combos` (owned por `restaurant`, mismo módulo que F2 — solo si F2 está aplicado)
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `translations` | json | nullable | `{ [langCode]: { name?: string; description?: string } }` |

  Ningún campo `translations` acepta la clave `'es'` — se valida y se rechaza en el
  usecase (no en el schema, que no puede inspeccionar claves de un objeto arbitrario) para
  no crear una segunda fuente de verdad para el idioma base.

## API

`CreateCategorySchema`/`UpdateCategorySchema`, `CreateItemSchema`/`UpdateItemSchema` y
(si F2 aplica) los schemas de combo se EXTIENDEN:

```
translations?: Record<string, { name?: string; description?: string }>   // type: 'json'
```

El usecase de `update`/`create` (`items-crud.ts`, `categories-crud.ts`) MUST rechazar con
`ValidationError` si `translations` trae la clave `es` (`"El idioma base (es) no se
traduce; usá los campos name/description"`).

Lectura: `GET /api/restaurant/categories`, `/menu-items`, `/combos` (si aplica) aceptan
un query param `?lang=xx` opcional. Si se omite o es `es`, el comportamiento es IDÉNTICO
al actual (cero cambios para quien no pida idioma). Si viene un `lang` soportado, el
usecase resuelve `name`/`description` con el fallback campo por campo antes de armar el
DTO de respuesta — el JSON crudo de `translations` NO viaja en la respuesta cuando se pide
un `lang` específico (para no duplicar el payload); si `lang` se omite, si viaja completo
(para que el editor de la carta en `carta.vue` pueda mostrar todos los idiomas cargados).

## UI

- En `carta.vue`, el editor de categoría/ítem agrega un selector de idioma (mismo patrón
  ya construido en `settings/index.vue:525-538`: pestañas de idioma con `●` verde en las
  que ya tienen contenido, contador "N / M idiomas completados") con los mismos 12 idiomas
  de `supportedLangs` (`settings/index.vue:1464-1477`) para no inventar una lista nueva.
- El tab `es` NO es editable ahí — el nombre/descripción en español se editan en los
  campos ya existentes del formulario (`CreateItemSchema.name`/`description`), el selector
  de idioma solo cubre las traducciones adicionales.
- La carta pública (F7) y, opcionalmente, `comanda.vue` (si el mesero atiende a un huésped
  que no habla español) leen con `?lang=` según la preferencia del huésped.
