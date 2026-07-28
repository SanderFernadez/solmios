# Landing Builder Specification (F1)

## Purpose

Construir la **landing page pública del hotel** en `/h/:slug`, configurable por bloques
desde el admin. Cada hotel define qué bloques muestra (toggle active), en qué orden
(drag-and-drop), y con qué config (textos, imágenes, FAQ items, etc.). El bloque
`ReviewsBlock` consume el endpoint F0 de reseñas públicas; `RoomsBlock` consume el
endpoint F2 de tarifas con "From $X".

Hoy no existe ninguna landing pública por hotel. Las únicas páginas públicas son
`/menu/:hotelId` (carta restaurante) y `/book/:slug` (widget sin pago). Este spec llena
el vacío con SEO completo (JSON-LD Hotel/LodgingBusiness + AggregateRating + FAQPage +
Offer, meta dinámicos, OpenGraph, sitemap).

Equivalente MisterPlan: "Constructor de Web Directa" (CMS por bloques del hotel).

## Requirements

### Requirement: 9 tipos de bloque fijos (catálogo en código)

El sistema MUST soportar exactamente 9 tipos de bloque (no administrable, mismo patrón
que `ALLERGEN_TAGS`): `hero`, `gallery`, `amenities`, `location`, `reviews`, `rooms`,
`faq`, `cta`, `footer`. Cada hotel tiene hasta 9 filas en `landing_blocks` (una por
type), con `active` toggleable y `sortOrder` configurable.

#### Scenario: Bloques default para hotel nuevo

- GIVEN hotel recién creado (sin filas en `landing_blocks`)
- WHEN la primera llamada a `GET /api/public/hotels/:slug/landing`
- THEN el seeder inserta 9 filas default (todas `active=1`, sortOrder estándar hero=0,
  gallery=1, amenities=2, rooms=3, reviews=4, location=5, faq=6, cta=7, footer=8) y las
  devuelve

#### Scenario: Toggle off oculta el bloque

- GIVEN hotel con bloque `reviews` `active=0`
- WHEN `GET /api/public/hotels/:slug/landing`
- THEN el array de bloques NO incluye `reviews`

### Requirement: Config JSON por bloque

Cada bloque guarda su configuración en `config` (JSON). El schema del config depende del
`type`:
- `hero`: `{title, subtitle, ctaText, backgroundMediaId}`.
- `gallery`: `{title}` (las fotos se toman de `hotel_media` type='gallery').
- `amenities`: `{title}` (los items se toman de `hotels.amenities`).
- `location`: `{title, description}` (lat/lng del hotel, mapa Leaflet).
- `reviews`: `{title, maxItems}` (consume endpoint público de reviews).
- `rooms`: `{title, ctaText}` (consume endpoint F2 de tarifas "From $X").
- `faq`: `{title, items: [{question, answer}]}`.
- `cta`: `{title, subtitle, buttonText}`.
- `footer`: `{copyright, links: [{label, url}]}`.

#### Scenario: FAQ con items

- GIVEN bloque `faq` con `config.items = [{q:'¿Hora de check-in?', a:'15:00'}]`
- WHEN el frontend renderiza FAQBlock
- THEN muestra el par Q/A y emite JSON-LD `FAQPage`

### Requirement: Reorder atómico

El admin MUST reorderar via drag-and-drop → `PUT /api/landing` recibe el array completo
de bloques con `sortOrder` nuevo y se persiste atómico (transacción). Si algo falla a
mitad, la tabla NO queda en estado intermedio.

#### Scenario: Reorder persiste atómico

- GIVEN admin drag `rooms` al primer lugar
- WHEN `PUT /api/landing [{type:'rooms', sortOrder:0}, ...]`
- THEN los sortOrder se actualizan en una transacción; si la request falla a mitad, los
  sortOrder viejos se preservan

### Requirement: Ruta pública `/h/:slug` con SEO completo

La landing MUST servir HTML prerenderizado o SSR-ligero con:
- Meta tags dinámicos (`title`, `description`, `og:title`, `og:description`, `og:image`).
- JSON-LD `Hotel` (o `LodgingBusiness`) con `name`, `description`, `image`, `address`,
  `geo`, `starRating`, `amenityFeature`, `aggregateRating`, `makesOffer`.
- JSON-LD `FAQPage` si bloque FAQ activo.
- JSON-LD `Offer` con `priceCurrency`, `price` (= "From $X" del bloque rooms).
- Canonical URL `/h/:slug`.
- OpenGraph image = `hotel_media` hero.

#### Scenario: Indexabilidad Google

- GIVEN `/h/caribe-paradise` con bloque hero + reviews activos
- WHEN Google crawla la página
- THEN el HTML contiene `<script type="application/ld+json">` con `@type: 'Hotel'` Y
  `aggregateRating` (si hay reviews) Y `offers` (si hay tarifas)

#### Scenario: SEO sin reviews ni tarifas

- GIVEN hotel sin reviews visibles
- WHEN se renderiza JSON-LD
- THEN NO incluye `aggregateRating` (sin datos, mejor omitir que mostrar `{ratingValue: 0}`)

### Requirement: Sitemap por hotel

`GET /sitemap.xml` MUST listar `/h/:slug` por cada hotel con `onlineBookingStatus='active'`.
Refresca on-demand (admin edita hotel → invalidate cache del sitemap).

### Requirement: Mapa Leaflet lazy-load

El bloque `location` MUST cargar Leaflet solo cuando el bloque es visible
(IntersectionObserver). Tile layer OSM gratis, sin API key.

#### Scenario: Lazy-load

- GIVEN usuario abre `/h/:slug` en mobile 4G
- WHEN Network tab
- THEN Leaflet (`leaflet.js` + CSS) NO carga hasta que el usuario scrollea al bloque location

### Requirement: Rate-limit público

`rateLimit('public-landing:${ip}', {maxAttempts: 30, windowMs: 60_000})`.

## Database

- **NEW TABLE** `landing_blocks`

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK `hotels.id`, multi-tenant. Unique `(hotelId, type)` — 1 fila por tipo por hotel. |
| `type` | string | REQUIRED | Enum catálogo fijo (9 valores). |
| `config` | json | nullable | Schema depende del `type` (validado server-side). |
| `sortOrder` | integer | default 0 | Entero, orden dentro del hotel. |
| `active` | boolean (integer 0/1) | default 1 | Toggle visible. |
| `createdAt`, `updatedAt` | datetime | REQUIRED | Timestamps ORM. |

Unique index `(hotelId, type)`. Anti-patrón ORM (D5): todas las columnas declaradas en
`orm.define('LandingBlock', ...)`.

## API

### Admin (auth + permiso `landing:view|edit`)

- `GET /api/landing` — lista los 9 bloques del hotel del usuario (seed si no existen).
- `PUT /api/landing` — bulk upsert del array completo: body `[{id?, type, config, sortOrder, active}, ...]`. Atómico.
- `PATCH /api/landing/:id/toggle` — body `{active: bool}`. Toggle rápido sin re-PUT todo.

### Pública (sin auth, rate-limited)

- `GET /api/public/hotels/:slug/landing` — devuelve `[{type, config, sortOrder}]` solo de
  bloques `active=1`, ordenados por `sortOrder`.

## UI

### Builder admin (`frontend/src/pages/settings/landing.vue`)

- Lista vertical de los 9 bloques con drag handle (reorder).
- Cada bloque: toggle "Visible en la landing" + botón "Editar config" (abre modal
  específico por `type`).
- Editores por type:
  - `hero`: inputs `title`, `subtitle`, `ctaText`, media picker (hero media).
  - `faq`: lista editable de `{question, answer}` con add/remove.
  - `cta`: inputs `title`, `subtitle`, `buttonText`.
  - `footer`: inputs `copyright`, lista de `{label, url}`.
  - Otros (`gallery`, `amenities`, `location`, `reviews`, `rooms`): solo `title` + el
    contenido se toma automáticamente del schema hotel/media/reviews.
- Botón **"Guardar"** → `PUT /api/landing` con todo.
- Botón **"Ver en la web pública"** → abre `/h/:slug` en nueva pestaña.

### Landing pública (`frontend/src/pages/public/hotel-landing.vue`)

- Layout `none` (sin header/footer del panel SaaS).
- Renderiza bloques en orden, cada uno un componente Vue dedicado:
  `HeroBlock.vue`, `GalleryBlock.vue`, `AmenitiesBlock.vue`, `MapBlock.vue` (lazy Leaflet),
  `ReviewsBlock.vue`, `RoomsBlock.vue`, `FaqBlock.vue`, `CtaBlock.vue`, `FooterBlock.vue`.
- CTA del `HeroBlock` y `CtaBlock`: botón "Reservar" que redirige a `/book/:slug` (widget F2).
- JSON-LD inyectado via composable `useHotelJsonLd` en `<head>`.
