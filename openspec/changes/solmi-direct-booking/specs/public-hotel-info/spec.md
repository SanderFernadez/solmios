# Public Hotel Info Specification (F0)

## Purpose

Exponer el schema riquísimo del hotel (lat/lng → en realidad `latitude`/`longitude`,
`descriptionJson`, ITBIS, `accommodationType`, `starRating`, políticas, amenities) en un
endpoint público rico `GET /api/public/hotels/:slug` que sirva de base a la landing
configurable (F1) y al widget unificado (F2). Hoy el endpoint equivalente
`getHotelPublicInfo` (`bookingengine/controller.ts:60-85`) es un **stub**: devuelve
`name: hotelId, slug: hotelId` (`:73-74`) y hardcodea `checkIn:'14:00'`/`checkOut:'11:00'`
(`:76-77`) ignorando los defaults reales del modelo (`'15:00'`/`'12:00'`,
`hoteles/model.ts:21-22`).

El spec también agrega 3 columnas faltantes que la landing necesita y que el modelo NO
tiene hoy (verificado): `slug` (estable, no computado), `amenities` (a nivel hotel, no
habitaciones) y `descriptionTranslations` (multilingüe, mismo patrón que
`menu_items.translations` del módulo restaurant).

Equivalente MisterPlan: "Configuración de Web Directa" (sección de settings del hotel
donde se edita la info que ven los huéspedes en la web pública).

## Requirements

### Requirement: Resolución por slug estable

El endpoint público MUST resolver el hotel por `slug` (NO por `id` ni por `hotelId`).
El slug es una columna NUEVA declarada en `Hotels` (nullable en la migración, populada
por seeder), NO computada del nombre en runtime (como hace hoy `public-booking.ts:5`).

#### Scenario: Slug conocido devuelve datos

- GIVEN hotel "Caribe Paradise" con `slug='caribe-paradise'`
- WHEN `GET /api/public/hotels/caribe-paradise`
- THEN responde 200 con el DTO público rico (allow-list, ver requirement siguiente)

#### Scenario: Slug inexistente devuelve 404 (no revelar existencia)

- GIVEN no existe hotel con `slug='unknown-hotel'`
- WHEN `GET /api/public/hotels/unknown-hotel`
- THEN responde 404 con `{error: 'Hotel not found'}` (NO devolver datos parciales)

#### Scenario: Slug vacío o mal formado

- GIVEN un hotel con `slug=null` (no migrado)
- WHEN `GET /api/public/hotels/some-slug`
- THEN el seeder F0 ya debe haberlo poblado; si no, el endpoint responde 404 y el log
  indica "hotel sin slug, correr seeder" (no fallback a `id` — el slug es el namespace
  público)

### Requirement: Allow-list estricta de campos públicos

El DTO público MUST contener EXCLUSIVAMENTE campos seguros para exposición pública.
NUNCA MUST exponer: `taxId`, `ownerName`, `ownerTaxId`, `deviceEmail`, `warningPhone`,
`wifiNetwork`, `wifiPassword`, `internalNotes`, `bookingEngineUrl`, `motorVersion`,
`registrationNumber` (salvo decisión regulatory aparte).

#### Scenario: Campos sensibles no se exponen

- GIVEN hotel con `taxId='RNC123'`, `ownerTaxId='CedulaX'`, `wifiPassword='secret'`
- WHEN `GET /api/public/hotels/:slug`
- THEN la respuesta NO contiene ninguna de las claves `taxId`, `ownerTaxId`,
  `wifiPassword` (verificado con `Object.keys(response)`)

#### Scenario: Campos visibles incluyen schema completo de marketing

- GIVEN hotel con `descriptionJson`, `accommodationType='boutique'`, `starRating='4'`,
  `latitude=18.4`, `longitude=-69.6`, `taxName='ITBIS'`, `taxRate=18.0`, `amenities=['pool','gym']`
- WHEN `GET /api/public/hotels/:slug`
- THEN la respuesta incluye TODOS esos campos con sus valores

### Requirement: Motor desactivado devuelve 404

Si `hotels.onlineBookingStatus !== 'active'` (campo existente, `model.ts:46`), el
endpoint MUST devolver 404 — el hotel no acepta reservas públicas.

#### Scenario: Hotel con motor pausado

- GIVEN hotel con `onlineBookingStatus='paused'`
- WHEN `GET /api/public/hotels/:slug`
- THEN responde 404 con `{error: 'Booking engine not active'}` (no revelar datos del hotel)

### Requirement: Multilingüe con fallback español

El hotel soporta `descriptionJson` (base, español) + `descriptionTranslations` (map
`{lang: {title, description}}`). El endpoint acepta `?lang=en|pt` y aplica
`resolveForLang` (extraído a `shared/i18n.ts` desde `restaurant/usecases/i18n.ts:26`).
El fallback SIEMPRE es español base.

#### Scenario: Pedir idioma con traducción disponible

- GIVEN hotel con `descriptionJson={title:'Hola', description:'...'}`
  y `descriptionTranslations={en: {title:'Hello', description:'...'}}`
- WHEN `GET /api/public/hotels/:slug?lang=en`
- THEN la respuesta incluye `title:'Hello', description:'...'` en los campos visibles
  (no el `descriptionJson` crudo)

#### Scenario: Pedir idioma sin traducción → fallback español

- GIVEN hotel sin `descriptionTranslations.fr`
- WHEN `GET /api/public/hotels/:slug?lang=fr`
- THEN la respuesta usa el contenido de `descriptionJson` (español base)

### Requirement: Rate-limit por IP

El endpoint MUST aplicar `rateLimit('public-hotel-info:${ip}', {maxAttempts: 60,
windowMs: 60_000})` (60 req/min/IP, reusando la firma ya extensible de
`shared/middlewares/rate-limit.ts:19-22`).

#### Scenario: 61 request en 1 minuto desde la misma IP

- GIVEN un atacante hace 60 requests rápididos
- WHEN hace el request 61 dentro del minuto
- THEN responde 429 con `{error: 'Too many requests', retryAfter: <seconds>}`

## Database

- **MODIFIED TABLE** `hotels`

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `slug` | string | nullable (REQUIRED después de migrar) | Slug estable. Único global (namespace público). Seeder F0 lo puebla con `slugify(name)`. Editar `name` NUNCA cambia `slug` automáticamente. Formato validado `^[a-z0-9-]+$`. |
| `amenities` | json (array) | nullable | Amenities DEL HOTEL (pool, gym, spa, parking, wifi, restaurant, bar, etc.). DISTINTO de `RoomAmenities` que vive a nivel habitaciones. Catálogo fijo en código (mismo patrón que `ALLERGEN_TAGS` del módulo restaurant). |
| `descriptionTranslations` | json (object) | nullable | Map `{lang: {title, description}}`. Mismo formato que `menu_items.translations`. La clave `'es'` está PROHIBIDA adentro (español es la base, vive en `descriptionJson`). Validado por `assertNoBaseLangKey`. |

Las columnas existentes (`latitude`, `longitude`, `descriptionJson`, `taxName`, `taxRate`,
`accommodationType`, `starRating` — string, no number, verificado `model.ts:45`,
`onlineBookingStatus`, las 12 columnas de políticas) NO se modifican — solo se exponen
en el DTO.

**Anti-patrón ORM (D5)**: las 3 columnas nuevas MUST estar declaradas en el
`orm.define('Hotels', ...)` de `hoteles/model.ts`, case-sensitive. Sin declaración →
descarte silencioso (mem 1805).

## API

### `GET /api/public/hotels/:slug` (público, sin auth, rate-limited)

Query params:
- `lang` (opcional, default `'es'`): idioma para `descriptionJson` resolución.

Respuesta 200:
```json
{
  "id": "uuid",
  "slug": "caribe-paradise",
  "name": "Caribe Paradise",
  "description": "Hotel boutique en ...",
  "title": "Caribe Paradise — ...",
  "descriptionTranslations": {"en": {"title": "...", "description": "..."}},
  "accommodationType": "boutique",
  "starRating": "4",
  "latitude": 18.4,
  "longitude": -69.6,
  "address": "...",
  "province": "...",
  "municipality": "...",
  "locality": "...",
  "postalCode": "...",
  "phone": "+1 ...",
  "email": "info@...",
  "website": "https://...",
  "checkIn": "15:00",
  "checkOut": "12:00",
  "currency": "DOP",
  "taxName": "ITBIS",
  "taxRate": 18.0,
  "cancellationType": "flexible",
  "freeCancellation": true,
  "depositRequired": false,
  "depositPercent": 0,
  "releaseHours": 24,
  "logo": "https://.../hotel-logos/abc.png",
  "amenities": ["pool", "gym", "wifi"],
  "onlineBookingStatus": "active"
}
```

Errores:
- 404 `{error: 'Hotel not found'}` — slug no existe.
- 404 `{error: 'Booking engine not active'}` — `onlineBookingStatus !== 'active'`.
- 429 `{error: 'Too many requests', retryAfter}` — rate limit.

### `PUT /api/settings/hotel` (admin, auth + `settings:edit`)

El schema validator existente se EXTIENDE para aceptar los 3 campos nuevos:
`slug` (valida `^[a-z0-9-]+$` + uniqueness global), `amenities` (array de strings del
catálogo), `descriptionTranslations` (object con `assertNoBaseLangKey`). El endpoint ya
existe (settings admin) — solo se agregan los campos al schema y al usecase de update.

El editor de `slug` valida availability en tiempo real (debounced) — uniqueness es a
nivel GLOBAL (todos los hoteles), no por hotel.

## UI

- En `frontend/src/pages/settings/index.vue`, nueva pestaña **"Página pública"** con:
  - Campo `slug` (editable, con badge de disponibilidad ✓/✗ al lado).
  - Campos `title` y `description` base (español) → escriben `descriptionJson`.
  - Tabs ES/EN/PT para `descriptionTranslations` (ES bloqueado — es la base).
  - Multi-select de `amenities` con catálogo fijo y etiquetas en español
    (ej. 🏊 Piscina, 🏋️ Gimnasio, 💆 Spa, 🅿️ Parking, 📶 WiFi, 🍽️ Restaurante, 🍸 Bar).
  - Toggles `publishReviewScore` / `publishReviewComments` (campos existentes, hoy sin
    consumidor — F0 0.11 los consume para gatear el endpoint de reviews).
- La landing pública (F1) y el widget (F2) consumen este endpoint; no hay preview acá
  (F1 incluye un "Preview landing" que abre `/h/:slug` en nueva pestaña).
