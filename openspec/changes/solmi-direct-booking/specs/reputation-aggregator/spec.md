# Reputation Aggregator Specification (F3)

## Purpose

Implementar el agregador de reseñas externas (Google Business Profile + TripAdvisor
Content API + StayAPI para Booking/Airbnb/Expedia) que NINGÚN booking engine del mercado
integra nativamente. Hoy el módulo `opiniones` solo tiene reseñas directas (`channel`
siempre `'direct'`, verificación D-13) — los badges multi-canal que querramos mostrar en
el widget (F2) son decoración sin backend. Este spec construye ese backend: cron nightly
que puebla `external_reviews`, cache 24h versionado, y degrada graceful si una API cae.

Decision de stack (D3 en `design.md`): GBP (gratis) + TripAdvisor (free con backlink) +
StayAPI (€0-35/mes). NO TrustYou/Revinate (enterprise $125+/mes).

Equivalente MisterPlan: "Reputation" multi-canal — MisterPlan no agrega OTAs; este spec
supera el benchmark al integrar las 3 fuentes.

## Requirements

### Requirement: 3 conectores, normalización común

El sistema MUST implementar 3 conectores en `backend/src/connectors/`:
- `gbp-reviews.ts` — Google Business Profile API (OAuth2 service account).
- `tripadvisor-reviews.ts` — TripAdvisor Content API (header `x-api-key`).
- `stayapi-reviews.ts` — StayAPI agregador (Booking/Airbnb/Expedia).

Cada conector:
- Lee credenciales desde `configuration(key='external_reviews_<source>')`.
- Llama la API externa, normaliza al schema `ExternalReviewModel`.
- Try/catch — si la API cae, loguea y devuelve `[]` (NO rompe el cron).
- Devuelve array de reviews normalizadas.

#### Scenario: GBP cae, TripAdvisor y StayAPI siguen

- GIVEN hotel con creds GBP + TripAdvisor + StayAPI
- WHEN GBP responde 500
- THEN el cron igualmente procesa TripAdvisor + StayAPI, loguea `gbp_error: 500`, y el
  GBP score degradado al último valor cacheado (no a 0)

### Requirement: Normalización al schema único

Cada conector MUST mapear su schema externo a:
```
{source, sourceExternalId, authorName, rating, title, comment, language, submittedAt, url}
```
- `rating` normalizado a escala 1-5 (TripAdvisor ya es 1-5; GBP ya es 1-5; StayAPI ya es 1-5).
- `language` código ISO 639-1 (`'es'`, `'en'`, etc.).
- `submittedAt` ISO 8601.
- `sourceExternalId` es el ID externo (D11 dedup).

### Requirement: Dedup por (source, sourceExternalId)

El cron MUST hacer upsert batch con `ON CONFLICT (source, sourceExternalId)` — si la
review externa ya existe (mismo source + mismo externalId), updatea solo `respondedAt` /
campos mutables, NO duplica. UNIQUE INDEX `(source, sourceExternalId)`.

#### Scenario: Review ya migrada

- GIVEN cron nightly anterior populó una review de Google con `sourceExternalId='abc123'`
- WHEN el próximo pull trae la misma review
- THEN se hace UPDATE (no INSERT, no duplica)

### Requirement: Cron nightly idempotente

El cron corre 00:00 UTC. Para cada hotel con creds configuradas, pull las 3 fuentes en
paralelo, dedup, upsert batch, bump de versión en cache.

#### Scenario: Correr 2× no duplica

- GIVEN cron ya corrió anoche
- WHEN se dispara manualmente ("Sync now" en admin)
- THEN 0 inserts nuevos (todas las reviews ya están), solo updates si algo cambió

### Requirement: Cache versionado 24h por hotel (D6)

El aggregate MUST cachearse con key `reviews:v{N}:{hotelId}`, TTL 24h. El cron bump `N`
tras escribir. El endpoint público F0 (0.11) lee del cache; si miss, computa y popula.
Las claves de listado incluyen filtros + paginación + versión.

#### Scenario: Cache hit

- GIVEN cron acaba de populatar, cache fresco
- WHEN 100 requests a `/reviews`
- THEN solo la primera computa, las 99 restantes sirven del cache (<50ms)

### Requirement: Rate-limit estricto por fuente externa

Los connectors MUST respetar los rate-limits de cada API:
- TripAdvisor: 500 req/day — 1 pull por hotel por noche (no más).
- GBP: 200k req/day — sin estrés.
- StayAPI: depende del plan — el conector lo documena.

El cron corre 00:00 UTC para NO chocar con picos de uso de la API externa.

### Requirement: Configuración admin por hotel

Cada hotel configura sus propias creds en Settings → "Reputación externa":
- GBP: `gbp_service_account` (JSON service account), `gbp_place_id`.
- TripAdvisor: `tripadvisor_api_key`, `tripadvisor_location_id`.
- StayAPI: `stayapi_api_key`, `stayapi_hotel_ids` (map `{booking: '123', airbnb: 'abc', ...}`).

Botón **"Sync now"** dispara el pull manualmente (dev tool, no expone en prod para evitar
abuso). Botón **"Test connection"** valida que las creds funcionan sin persistir nada.

#### Scenario: Config inválida

- GIVEN admin pega un `gbp_place_id` inexistente
- WHEN click "Test connection"
- THEN error "Google Place ID no encontrado" y NO se persiste (el test corre sin guardar)

### Requirement: Backlink TripAdvisor OBLIGATORIO

Si TripAdvisor está activo, la landing `/h/:slug` MUST mostrar "Reviews by TripAdvisor"
en el footer del bloque `ReviewsBlock` con link a la página oficial. TripAdvisor suspende
la API key si no hay backlink.

## Database

- **NEW TABLE** `external_reviews` (módulo `external-reviews`)

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK `hotels.id`, multi-tenant. |
| `source` | string | REQUIRED | Enum `'google'` \| `'tripadvisor'` \| `'booking'` \| `'airbnb'` \| `'expedia'`. |
| `sourceExternalId` | string | REQUIRED | ID externo para dedup. |
| `authorName` | string | nullable | |
| `rating` | number | REQUIRED | 1-5 (escala normalizada). |
| `title` | string | nullable | |
| `comment` | string | nullable | |
| `language` | string | nullable | ISO 639-1 (`'es'`, `'en'`, etc.). |
| `submittedAt` | datetime | REQUIRED | |
| `url` | string | nullable | Link a la review original (Google/TripAdvisor/...). |
| `createdAt`, `updatedAt` | datetime | REQUIRED | |

UNIQUE INDEX `(source, sourceExternalId)`. INDEX `(hotelId, source, submittedAt)` para
queries por hotel ordenadas por fecha.

Anti-patrón ORM (D5): todas las columnas declaradas en `orm.define('ExternalReview', ...)`.

## API

### Admin (auth + permiso `reviews:edit`)

- `GET /api/external-reviews/config` — devuelve config actual (creds mascaradas, ej. `***123`).
- `PUT /api/external-reviews/config` — guarda creds.
- `POST /api/external-reviews/test-connection` — body `{source, creds}` valida sin persistir.
- `POST /api/external-reviews/sync-now` — dispara pull (devuelve `{pulled: N, new: M}`).

### Públicos

El endpoint F0 `GET /api/public/hotels/:slug/reviews` (0.11) se EXTIENDE para incluir
`external_reviews` en el aggregate y en el listado (con `?source=google|tripadvisor|...`).

### Interno (cron)

- Cron nightly corre a 00:00 UTC. Idempotente. Best-effort (falla 1 fuente no rompe).

## UI

- Settings → "Reputación externa" (nueva sub-pestaña de Reseñas):
  - 3 cards verticales (Google, TripAdvisor, StayAPI) con:
    - Inputs para creds.
    - Botón "Test connection" (valida sin guardar).
    - Status (last sync: hace X horas, reviews importadas: N).
    - Botón "Sync now".
- Bloque `ReviewsBlock` de la landing (F1) muestra badges multi-canal:
  - Si hay reviews Google → badge "Google ⭐ 4.5 (N)".
  - Si hay TripAdvisor → badge "TripAdvisor ⭐ 4.5 (N)".
  - Si hay Booking/Airbnb via StayAPI → badges respectivos.
  - TripAdvisor badge es link con `rel="nofollow"` al backlink REQUIRED.
- Badge de score agregado propio "SOLMI Score" (promediando las 3-5 fuentes con peso
  opcional admin-configurable).

## Auth flow de APIs externas (REQUIRED — `openspec/config.yaml` design rule)

### Google Business Profile (OAuth2 service account)

1. Hotel dueño crea Google Cloud project + service account + habilita GBP API.
2. Sube JSON service account a Settings → SOLMI OS lo guarda en `configuration`.
3. SOLMI OS genera JWT assertion (RS256 con private key del service account).
4. POST a `https://oauth2.googleapis.com/token` con
   `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, scope
   `https://www.googleapis.com/auth/business.manage`.
5. Recibe access token (TTL 1h), lo cachea, usa en calls a
   `https://mybusiness.googleapis.com/v4/{placeId}/reviews`.

### TripAdvisor Content API

1. Hotel dueño solicita API key en https://developer-tripadvisor.com/.
2. Pega la key + su `locationId` en Settings.
3. SOLMI OS llama `https://api.content.tripadvisor.com/api/v1/location/{locationId}/reviews`
   con header `x-api-key: <key>`.
4. Rate limit: 500 req/day — 1 pull por hotel por noche.
5. REQUIRED backlink "Reviews by TripAdvisor" en la landing.

### StayAPI

1. Hotel dueño se suscribe (€35/mes o pay-per-review).
2. Pega API key + mapeo `{booking_property_id, airbnb_listing_id, expedia_property_id}`
   en Settings.
3. SOLMI OS llama `https://api.stayapi.com/v1/reviews/{source}?hotel_id=<mapped_id>` con
   header `Authorization: Bearer <key>`.
4. Una llamada por OTA source (3 calls por hotel por noche).
