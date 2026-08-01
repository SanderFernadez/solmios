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

### Requirement: 11 tipos de bloque fijos (catálogo en código)

El sistema MUST soportar exactamente 11 tipos de bloque (no administrable, mismo patrón
que `ALLERGEN_TAGS`): `hero`, `trust-badges`, `storytelling`, `gallery`, `amenities`,
`location`, `reviews`, `rooms`, `faq`, `cta`, `footer`. Cada hotel tiene hasta 11 filas en
`landing_blocks` (una por type), con `active` toggleable y `sortOrder` configurable.

Agregar un type nuevo al catálogo NO reconcilia retroactivamente hoteles ya seedeados por
sí solo: `listByHotel`/`listPublicBySlug` disparan `seedDefaults` (idempotente por-type)
si `existing.length < BLOCK_TYPES.length` — cualquier faltante, no solo hotel en cero.

#### Scenario: Bloques default para hotel nuevo

- GIVEN hotel recién creado (sin filas en `landing_blocks`)
- WHEN la primera llamada a `GET /api/public/hotels/:slug/landing`
- THEN el seeder inserta 11 filas default (todas `active=1`, sortOrder estándar hero=0,
  trust-badges=1, storytelling=2, gallery=3, amenities=4, rooms=5, reviews=6, location=7,
  faq=8, cta=9, footer=10) y las devuelve

#### Scenario: Toggle off oculta el bloque

- GIVEN hotel con bloque `reviews` `active=0`
- WHEN `GET /api/public/hotels/:slug/landing`
- THEN el array de bloques NO incluye `reviews`

### Requirement: Config JSON por bloque

Cada bloque guarda su configuración en `config` (JSON). El schema del config depende del
`type`:
- `hero`: `{title, subtitle, ctaText, backgroundMediaId, searchBar: {enabled, ctaText}}`
  (`searchBar` default `enabled:true` — es el elemento central del hero, buscador inline
  que navega a `/book/:slug` con query params; el frontend arma la navegación, el backend
  solo persiste el flag. `title`/`subtitle` default string vacío — el frontend cae al
  nombre/descripción real del hotel, nunca copy genérico fijo).
- `trust-badges`: `{title, items: [{icon, text}]}` (fila de sellos de confianza debajo
  del hero; `icon` es string libre, sin enum server-side — el frontend mapea un set fijo
  de keys a SVGs).
- `storytelling`: `{title, description, linkText, mediaIds}` (sección de apoyo tipo "Vive
  una experiencia única" — texto + fotos, entre trust-badges y gallery. `description`
  default string vacío — sin inventar copy de marketing; el bloque NO renderiza si
  `description` está vacío Y `mediaIds` no resuelve ninguna foto. `mediaIds` referencia
  `hotel_media` type='gallery', mismo picker que `hero.backgroundMediaIds`).
- `gallery`: `{title}` (las fotos se toman de `hotel_media` type='gallery').
- `amenities`: `{title}` (los items se toman de `hotels.amenities`).
- `location`: `{title, description}` (lat/lng del hotel, mapa embebido Google Maps).
- `reviews`: `{title, maxItems}` (consume endpoint público de reviews).
- `rooms`: `{title, ctaText, showSpecs, featuredRoomId, featuredBadgeText}`
  (consume endpoint F2 de tarifas "From $X"; `featuredRoomId` referencia `rooms.id` sin
  FK física —igual criterio que `backgroundMediaId`—, lo elige el admin manualmente, SIN
  cálculo automático por reservas; `featuredBadgeText` es el texto libre del badge,
  default "Más reservada").
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

### Requirement: Mapa embebido con 2 tiers (SDK interactivo / iframe embed)

DEPRECATED 2026-07-31 (pedido explícito del usuario, "pon el iframe de google ahí en
vez de ese"): el bloque `location` reemplazó Leaflet+OSM por Google Maps.
`leaflet`/`@types/leaflet` se sacaron de `package.json` (sin otro uso en el repo).

ACTUALIZADO 2026-08-01: el bloque `location` (`MapBlock.vue`) MUST soportar 2 tiers,
degradando sin error:

1. **CON key** (`PublicHotelInfo.googleMapsApiKey`, resuelta server-side en
   `public-hotel-info.ts` desde `configuration(hotelId, key:'google_maps')` con fallback
   a `platform` — NUNCA hardcodeada ni expuesta como secret: es una Maps JS key,
   restringida por dominio del lado de Google): SDK real vía `useGoogleMaps.loadGoogleMaps(explicitKey)`,
   mapa interactivo (zoom/pan/marker), mismo mecanismo que ya usa el admin en
   `pages/settings/index.vue`.
2. **SIN key, o si la key falla/está restringida a otro dominio** (`gm_authFailure`):
   `<iframe>` embed público (`google.com/maps?q=lat,lng&output=embed`, sin key),
   lazy-load nativo (`loading="lazy"`).

El bloque MUST diferir el bootstrap del tier interactivo hasta que sea visible
(`IntersectionObserver`, `rootMargin: 200px`); si el navegador no soporta
`IntersectionObserver`, carga inmediata. El tier iframe usa lazy nativo, no necesita
IntersectionObserver.

#### Scenario: Lazy-load sin key configurada

- GIVEN el hotel no tiene `google_maps` configurado (ni propio ni `platform`)
- WHEN usuario abre `/h/:slug` en mobile 4G
- THEN se renderiza el iframe de Google Maps, que NO empieza a cargar hasta que el
  usuario scrollea al bloque location (comportamiento nativo de `loading="lazy"`)

#### Scenario: Tier interactivo con key válida

- GIVEN el hotel (o `platform`) tiene `google_maps` configurado con una key válida
- WHEN el bloque `location` entra en viewport
- THEN se carga el SDK de Google Maps y se reemplaza el iframe por un mapa interactivo
  con marker en `[hotel.latitude, hotel.longitude]`

#### Scenario: Degradación por key inválida/restringida

- GIVEN el hotel tiene `google_maps` configurado pero la key es inválida o está
  restringida a otro dominio
- WHEN el SDK dispara `gm_authFailure`
- THEN el bloque se queda con el iframe embed (sin key) en vez de mostrar un mapa roto

### Requirement: Rate-limit público

`rateLimit('public-landing:${ip}', {maxAttempts: 30, windowMs: 60_000})`.

## Database

- **NEW TABLE** `landing_blocks`

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK `hotels.id`, multi-tenant. Unique `(hotelId, type)` — 1 fila por tipo por hotel. |
| `type` | string | REQUIRED | Enum catálogo fijo (11 valores). |
| `config` | json | nullable | Schema depende del `type` (validado server-side). |
| `sortOrder` | integer | default 0 | Entero, orden dentro del hotel. |
| `active` | boolean (integer 0/1) | default 1 | Toggle visible. |
| `createdAt`, `updatedAt` | datetime | REQUIRED | Timestamps ORM. |

Unique index `(hotelId, type)`. Anti-patrón ORM (D5): todas las columnas declaradas en
`orm.define('LandingBlock', ...)`.

## API

### Admin (auth + permiso `landing:view|edit`)

- `GET /api/landing` — lista los 11 bloques del hotel del usuario (seed si no existen).
- `PUT /api/landing` — bulk upsert del array completo: body `[{id?, type, config, sortOrder, active}, ...]`. Atómico.
- `PATCH /api/landing/:id/toggle` — body `{active: bool}`. Toggle rápido sin re-PUT todo.

### Pública (sin auth, rate-limited)

- `GET /api/public/hotels/:slug/landing` — devuelve `[{type, config, sortOrder}]` solo de
  bloques `active=1`, ordenados por `sortOrder`.

## UI

### Builder admin (`frontend/src/pages/settings/landing.vue`)

- Lista vertical de los 11 bloques con drag handle (reorder).
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
  `HeroBlock.vue`, `StorytellingBlock.vue`, `GalleryBlock.vue`, `AmenitiesBlock.vue`,
  `MapBlock.vue` (Google Maps, SDK interactivo con key o iframe embed sin key),
  `ReviewsBlock.vue`, `RoomsBlock.vue`,
  `FaqBlock.vue`, `CtaBlock.vue`, `FooterBlock.vue`.
- CTA del `HeroBlock` y `CtaBlock`: botón "Reservar" que redirige a `/book/:slug` (widget F2).
- JSON-LD inyectado via composable `useHotelJsonLd` en `<head>`.
