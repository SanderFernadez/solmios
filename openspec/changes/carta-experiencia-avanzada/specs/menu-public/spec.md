# Menu Public Specification (F7)

## Purpose

Servir la carta del restaurante sin login, para que un huésped la vea desde su celular
escaneando un QR de mesa (solo lectura — el huésped VE la carta, no pide; self-order queda
explícitamente Out of Scope en `proposal.md`). Dominio NUEVO: una ruta HTTP sin
`auth.authenticate()`, protegida por rate-limit, que expone un subconjunto curado de
`menu_categories`/`menu_items`/`menu_combos`.

**Patrón real a reusar (no inventar uno nuevo)**: el codebase YA tiene rutas públicas sin
ningún middleware de auth. La más cercana en forma es `bookingengine`
(`modules/bookingengine/index.ts:70`, `GET /api/public/hotel/:slug`) — y revisando su
implementación real (`controller.ts:63`: `const hotelId = req.params.slug`, resuelto
directo por `getHotelPublicInfo`), el "slug" en la práctica **es el `hotelId` crudo**
(UUID) para ESA ruta; no existe ninguna columna `slug` en `hotels`.

**Corrección post-QA**: la cita original a `usecases/public-booking.ts:5` para respaldar
esto era errónea — esa línea pertenece a `getPublicBookingBySlug`, función de la ruta
HERMANA `/api/public/booking/:slug`, que es más matizada (soporta un slug derivado del
nombre del hotel además del id crudo: `hotels.find(h => h.name?.toLowerCase().replace(/\s+/g,'-')
=== slug || h.id === slug)`). La afirmación central para ESTA spec (que
`/api/public/hotel/:slug` usa el slug como `hotelId` literal) sigue siendo correcta y está
bien respaldada solo por `controller.ts:63`; no corresponde citar `public-booking.ts`.
Este spec sigue exactamente el patrón de `getHotelPublicInfo` (id crudo en el path, sin
slug derivado) — no el de `getPublicBookingBySlug` — porque no hay necesidad de un slug
amigable para un QR de mesa: la ruta pública toma `hotelId` (UUID) directo en el path, sin
inventar un sistema de slugs o tokens que no existe en ningún otro módulo. El UUID no es
enumerable (a diferencia de un
id secuencial), y el riesgo real (`proposal.md`, tabla de Risks: "F7 expone precios/carta a
competencia vía scraping") ya lo asume hoy `bookingengine` exponiendo disponibilidad y
tarifas de habitaciones por el mismo mecanismo, sin que el proyecto lo haya considerado
nunca un problema de seguridad — la carta pública no es más sensible que eso.

El otro precedente de ruta pública real, `reservas` (`modules/reservas/index.ts:81-83`,
`GET/POST /api/public/pre-checkin/:hash`), NO usa rate-limit ninguno en su implementación
actual — pero este spec SÍ lo exige explícitamente (instrucción del change), porque el
riesgo de esos dos casos es distinto: pre-checkin es una consulta 1-a-1 sobre una reserva
puntual con un hash de un solo uso; la carta pública es un catálogo completo, scrapeable
en loop por cualquier IP sin ningún hash que expire.

## Requirements

### Requirement: Ruta sin autenticación, con rate-limit por IP

El sistema MUST exponer `GET /api/public/menu/:hotelId` SIN `auth.authenticate()` ni
`requirePermission(...)` en su array de middlewares (mismo criterio que
`/api/public/pre-checkin/:hash` y `/api/public/hotel/:slug`: el array de la ruta, si
existe, no incluye ningún guard de sesión). El handler MUST aplicar rate-limit por IP
usando el helper ya existente `rateLimit()`/`getClientIp()`
(`shared/middlewares/rate-limit.ts`), con el mismo patrón inline ya usado en
`modules/usuarios/index.ts:46-60` para `/api/auth/login` (el helper no es un middleware
de framework, es una función que se llama a mano dentro del handler y devuelve 429 antes
de tocar el service).

#### Scenario: Acceso normal sin sesión

- GIVEN un huésped sin cuenta ni token
- WHEN abre la URL del QR de su mesa (`GET /api/public/menu/{hotelId}`)
- THEN recibe 200 con la carta, sin que el request lleve ningún header de auth

#### Scenario: Scraping agresivo se corta por IP

- GIVEN una IP que ya superó el límite propio de esta ruta en la ventana configurada
- WHEN esa IP hace un request más
- THEN el sistema responde 429 con `retryAfter` en segundos, sin tocar el repositorio

**Corrección post-QA (riesgo de disponibilidad real, no cubierto en la versión anterior de
este spec)**: reusar el límite de `/api/auth/login` (`MAX_ATTEMPTS=20`/`WINDOW_MS=5min`) tal
cual es incorrecto para esta ruta. En login, `resetAttempts(key)` se llama tras un login
EXITOSO, así que solo los intentos FALLIDOS acumulan contra el límite. La carta pública no
tiene ningún evento de "éxito" que resetee el contador — cada request, legítimo o no, suma
igual. Con el límite de login, una IP compartida (WiFi del hotel, NAT del restaurante con
varios huéspedes escaneando el mismo QR durante el almuerzo) alcanzaría 429 en tráfico
normal, no solo en scraping. Este spec MUST usar una clave y un límite PROPIOS para esta
ruta (`rateLimit('public-menu:' + hotelId + ':' + getClientIp(req), { maxAttempts: 120,
windowMs: 5 * 60_000 })` — límite muchísimo más alto que el de login, acorde a que es
lectura pública sin costo de negocio por request de más, compuesto por hotel+IP para que
el tráfico de un hotel no consuma el cupo de otro que comparta salida NAT), NUNCA el mismo
`key`/límite que `/api/auth/login`.

#### Scenario: `hotelId` inexistente no filtra información

- GIVEN un `hotelId` que no corresponde a ningún hotel
- WHEN se pide `/api/public/menu/{hotelId}`
- THEN el sistema responde 404 genérico, sin distinguir "hotel no existe" de "hotel sin
  módulo restaurant habilitado" (mismo mensaje para ambos, para no filtrar qué hoteles
  tienen o no el POS activo)

### Requirement: Campos que el sistema NUNCA expone

El DTO público MUST excluir explícitamente, sin excepción: **costo de receta** (todo lo
derivado de F3 — `cost`, `margin`, `marginPercent`, `hasRecipe`/`complete`), **la receta
en sí** (`menu_item_recipes`, insumos y cantidades), **cualquier dato de `inventory_items`**
(incluido `avgCost`, `currentStock`), **ids internos que no son parte del contenido a
mostrar** (`hotelId` en cada fila — ya viaja una sola vez en el path, no repetido por
ítem —, `stationId`/`stationName` — ruteo interno al KDS, el huésped no necesita saber
qué estación prepara el plato —, `sortOrder` — el backend ya devuelve la lista
pre-ordenada, no hace falta que el cliente la reordene —), y **`taxRate`** (detalle de
facturación interno; el precio mostrado es el mismo `price` que ve el mesero en Carta, sin
desglose impositivo).

#### Scenario: El payload público no tiene ninguna de esas claves

- GIVEN un ítem con receta costeada, estación asignada y tasa de impuesto propia
- WHEN se pide la carta pública
- THEN la fila del ítem en la respuesta tiene únicamente: `id`, `name`, `description`,
  `price`, `imageUrl`, `allergens`, `featured`, `availableFrom`, `availableTo`,
  `availableNow`
- AND ninguna de las claves `cost`, `margin`, `marginPercent`, `hasRecipe`, `complete`,
  `avgCost`, `currentStock`, `stationId`, `stationName`, `sortOrder`, `taxRate` aparece en
  ningún nivel del JSON

#### Scenario: Combos públicos muestran componentes por nombre, no por id de costo

- GIVEN `Combo Familiar` con 3 componentes
- WHEN se pide la carta pública
- THEN cada combo lista sus componentes como `{ name, quantity }` (para que el huésped
  sepa qué incluye), SIN `menuItemId` crudo del componente ni ningún dato de costo

### Requirement: Ítems agotados vs. fuera de horario se tratan distinto

Un ítem con `available=0` (86'd manualmente, ver F6) MUST excluirse por completo de la
carta pública — no tiene sentido mostrarle al huésped una foto de algo que hoy no se
puede pedir de ninguna manera. Un ítem fuera de su franja horaria (F6,
`availableFrom`/`availableTo`) MUST seguir apareciendo, pero con `availableNow: false` y
la franja visible — el huésped puede estar mirando la carta a las 15:00 para decidir si
vuelve a cenar, y el menú de cena es información útil aunque no se pueda pedir ahora
mismo.

#### Scenario: Ítem 86'd no aparece en absoluto

- GIVEN "Salmón" con `available=0` (sin stock hoy)
- WHEN se pide la carta pública
- THEN "Salmón" no aparece en la respuesta, ni con ningún flag "no disponible"

#### Scenario: Ítem fuera de franja horaria aparece con su horario

- GIVEN "Pancakes" (franja 07:00-11:00, `available=1`) y son las 15:00
- WHEN se pide la carta pública
- THEN "Pancakes" aparece en la respuesta con `availableNow: false`,
  `availableFrom: "07:00"`, `availableTo: "11:00"`

### Requirement: Multi-idioma (F4) e i18n opcional en la carta pública

La ruta pública MUST aceptar `?lang=xx` (mismo contrato que F4) y resolver
nombre/descripción con el mismo fallback campo-por-campo al español. Si F4 no está
aplicado (o el ítem no tiene esa traducción), la respuesta cae al español sin error.

#### Scenario: Huésped que cambia el idioma de la carta pública

- GIVEN un ítem con `translations.en` cargado
- WHEN se pide `/api/public/menu/{hotelId}?lang=en`
- THEN el nombre/descripción llegan en inglés; los que no tienen traducción caen al
  español

## Database

Ninguna tabla ni columna nueva — esta spec es 100% una vista de lectura curada sobre
datos ya existentes (`menu_categories`, `menu_items`, `menu_combos`/`menu_combo_items` si
F2 aplica, `translations`/`allergens`/`featured`/`availableFrom`/`availableTo` si F4/F5/F6
aplican).

## API

| Método | Ruta | Auth | Rate limit | Query |
|---|---|---|---|---|
| GET | `/api/public/menu/:hotelId` | NINGUNA (sin `auth.authenticate()`) | `rateLimit('public-menu:' + hotelId + ':' + getClientIp(req), { maxAttempts: 120, windowMs: 5*60_000 })`, 429 si excede — clave y límite PROPIOS, nunca el de `/api/auth/login` (ver corrección post-QA arriba) | `?lang=xx` opcional |

Response shape:

```
{
  hotel: { name: string },
  categories: [
    { id, name, items: [
        { id, name, description, price, imageUrl, allergens, featured,
          availableFrom, availableTo, availableNow }
    ] }
  ],
  combos: [
    { id, name, description, price, imageUrl, allergens, featured,
      components: [{ name, quantity }] }
  ]
}
```

`hotel.name` es el ÚNICO dato de `hotels` que viaja (para el encabezado de la página) —
nada de `ownerName`, `taxId`, `email`, `phone` u otro campo del hotel.

Implementación: un usecase nuevo `restaurant/usecases/public-menu.ts` (mencionado en
`proposal.md`, Affected Areas) que arma el DTO curado a partir de `listCategories`/
`listItems`/`listCombos` YA existentes, filtrando explícitamente los campos permitidos
(allow-list, nunca deny-list — un campo nuevo que se agregue a `MenuItemDTO` en el futuro
NO se expone por accidente si el usecase arma el objeto de salida campo por campo en vez
de hacer spread del DTO interno).

Si el módulo `restaurant` no está habilitado para el hotel (plan sin ese módulo, ver
`createModuleGuard`), la ruta responde 404 — NO usa `moduleGuard` (que depende de
`auth.authenticate()` para resolver el usuario) sino un chequeo directo contra
`configuration`/`plans` equivalente, sin sesión.

## UI

- Página nueva `frontend/src/pages/public/menu.vue` (mencionada en `proposal.md`), SIN el
  layout de panel (sidebar/header de `SuperAdminLayout`/layout del hotel) — un layout
  propio minimalista, mobile-first (el huésped la abre desde el celular).
- Selector de idioma visible si hay más de un idioma con traducciones cargadas (F4).
- Los ítems destacados (F6) se muestran en una sección "Recomendados" arriba de las
  categorías.
- Los ítems fuera de horario (F6) se muestran atenuados con su franja horaria visible, NO
  ocultos (ver requirement de arriba).
- Los alérgenos (F5) se muestran como íconos/badges junto a cada ítem.
- Genera el QR client-side a partir de la URL pública (`/menu/:hotelId`) — sin servicio
  externo, tal como ya lo resuelve `proposal.md` en su sección Dependencies.
