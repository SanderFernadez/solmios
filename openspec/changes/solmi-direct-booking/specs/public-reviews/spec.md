# Public Reviews Specification (F0)

## Purpose

El módulo `opiniones` ya recolecta reseñas post-checkout via el connector
`reservas-opiniones.ts:14` (subscribe a `onReservationCheckedOut`, invite con token
público `/resena/:token`). Pero **no existe ningún endpoint público** que muestre las
reseñas en la landing o el widget — solo endpoints token-gated (uno por reseña, para que
el huésped la complete). Las flags `publishReviewScore` / `publishReviewComments`
(`hoteles/model.ts:64-66`) están en el modelo pero **ningún endpoint público las lee**
(verificación D-12). No existe aggregate score en código (D-12).

Este spec crea el endpoint público `GET /api/public/hotels/:slug/reviews` con aggregate
score + distribución + paginación, respeta las flags, y agrega 2 columnas faltantes al
modelo opiniones (`sourceExternalId`, `respondedAt`) que F3 necesita para la ingestión
OTA y el tracking de respuestas.

Equivalente MisterPlan: "Reseñas en la Web Directa" del módulo Reputation.

## Requirements

### Requirement: Endpoint público lista reseñas aprobadas

El endpoint MUST devolver solo reseñas con `status='visible' AND visible=1` del hotel
resuelto por slug. Soporta paginación (`?page=1&limit=10`), filtro por fuente
(`?source=all|direct|google|tripadvisor|booking|airbnb|expedia`), y orden (default:
más recientes primero).

#### Scenario: Listar reseñas paginadas

- GIVEN hotel con 25 reseñas directas visibles
- WHEN `GET /api/public/hotels/:slug/reviews?page=1&limit=10`
- THEN responde `{reviews: [...10], pagination: {page:1, limit:10, total:25, totalPages:3}}`

#### Scenario: Filtrar por fuente

- GIVEN hotel con 5 direct y 3 google (F3 ingestión ya aplicada)
- WHEN `GET /api/public/hotels/:slug/reviews?source=google`
- THEN responde `{reviews: [...3 google], pagination: {total:3}}`

#### Scenario: Reservas pending o invisibles nunca aparecen

- GIVEN hotel con 1 reseña `status='pending'` (no aprobada) y 1 `visible=0`
- WHEN `GET /api/public/hotels/:slug/reviews`
- THEN NINGUNA de las dos aparece en el listado

### Requirement: Aggregate score computado, no persistido

El aggregate MUST ser computado al vuelo (y cacheado, NO persistido en una columna —
evita desincronización). El cómputo agrupa por `channel` y promedia sobre las reseñas
visibles.

#### Scenario: Hotel con reviews multi-canal

- GIVEN hotel con 4 directas (promedio 4.5) y 3 google (promedio 4.0)
- WHEN `GET /api/public/hotels/:slug/reviews`
- THEN `aggregate: {score: 4.29, count: 7, perSource: {direct: {score:4.5, count:4}, google: {score:4.0, count:3}}}`

#### Scenario: Hotel sin reseñas

- GIVEN hotel con 0 reseñas visibles
- WHEN `GET /api/public/hotels/:slug/reviews`
- THEN `aggregate: {score: 0, count: 0, perSource: {}}`

### Requirement: Distribución de estrellas

El endpoint MUST devolver `distribution: {5: 12, 4: 8, 3: 2, 2: 0, 1: 1}` (count por
estrella 1-5) para render del histograma.

#### Scenario: Distribución correcta

- GIVEN hotel con 12 reviews de 5 estrellas, 8 de 4, 2 de 3, 1 de 1
- WHEN `GET /api/public/hotels/:slug/reviews`
- THEN `distribution: {5:12, 4:8, 3:2, 2:0, 1:1}`

### Requirement: Flags publishReviewScore/publishReviewComments gatean el output

Si `hotels.publishReviewScore=false`, el endpoint MUST omitir `aggregate.score` (devolver
`score: null` pero SÍ el count). Si `hotels.publishReviewComments=false`, las reviews se
devuelven con `comment: null` (solo rating visible). Defaults `false` (`model.ts:64-66`)
→ el admin debe explícitamente activar para mostrar.

#### Scenario: publishReviewScore=false oculta el score

- GIVEN hotel con `publishReviewScore=false` y 5 reviews (avg 4.2)
- WHEN `GET /api/public/hotels/:slug/reviews`
- THEN `aggregate: {score: null, count: 5, perSource: ...}` (score null pero count visible)

#### Scenario: publishReviewComments=false oculta comentarios

- GIVEN hotel con `publishReviewComments=false`
- WHEN `GET /api/public/hotels/:slug/reviews`
- THEN cada review en el array tiene `comment: null` (solo rating/title visible si los hay)

### Requirement: Rate-limit por IP

`rateLimit('public-reviews:${ip}', {maxAttempts: 30, windowMs: 60_000})` (30 req/min/IP).

### Requirement: Cache versionado 24h (D6)

El endpoint MUST cachear la respuesta (incluyendo aggregate) por 24h en `CacheAdapter`
con clave versionada `reviews:v{N}:{hotelId}` (mismo patrón que `facturas/usecases/cache.ts`).
El cron F3 de ingestión bump `N` al escribir. El cache se invalida bumpeando versión,
no por clave fija.

#### Scenario: Cache hit sirve rápido

- GIVEN el cron F3 acaba de populatar
- WHEN 100 requests seguidas a `/reviews`
- THEN solo la primera computa, las 99 restantes sirven del cache

## Database

- **MODIFIED TABLE** `reviews` (modelo `opiniones`)

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `sourceExternalId` | string | nullable | ID externo en GBP/TripAdvisor/StayAPI. Para dedup en F3 ingestión. Unique por `(channel, sourceExternalId)` via índice. |
| `respondedAt` | datetime | nullable | Timestamp cuando el hotel posteó `response`. Seteado por el usecase existente al persistir `response`. |

Las columnas existentes (`rating`, `comment`, `channel` default `'direct'`, `status`,
`visible`, `token`, `response`, `date`, `reservationId`, `guestId`) NO se modifican.

**Anti-patrón ORM (D5)**: las 2 columnas nuevas declaradas en `orm.define('Review', ...)`.
Sin declaración → descarte silencioso.

Índice: `UNIQUE(channel, sourceExternalId) WHERE sourceExternalId IS NOT NULL` (PG);
en SQLite, índice normal + validación en usecase (soporte parcial limitado).

## API

### `GET /api/public/hotels/:slug/reviews` (público, sin auth, rate-limited)

Query params:
- `page` (default 1)
- `limit` (default 10, max 50)
- `source` (default `all`, valores: `all|direct|google|tripadvisor|booking|airbnb|expedia`)
- `lang` (default `es` — F3 i18n de comments en OTA ingestion)
- `sort` (default `recent`, valores: `recent|highest|lowest`)

Respuesta 200:
```json
{
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Excelente",
      "comment": "..." or null (si publishReviewComments=false),
      "response": "Gracias..." or null,
      "respondedAt": "2026-...",
      "date": "2026-...",
      "channel": "direct",
      "authorName": "Juan P.",
      "url": null (o link a TripAdvisor/Google review original si externa)
    }
  ],
  "aggregate": {
    "score": 4.29 or null,
    "count": 7,
    "perSource": {"direct": {"score":4.5,"count":4}, "google": {"score":4.0,"count":3}}
  },
  "distribution": {"5": 4, "4": 2, "3": 1, "2": 0, "1": 0},
  "pagination": {"page":1, "limit":10, "total":7, "totalPages":1}
}
```

Errores:
- 404 si hotel no existe o motor inactivo.
- 429 si rate-limit.

### Admin (existente, ampliado)

`POST /api/opiniones/:id/respond` ya existe (responder una reseña). F0 hace que el
usecase setee `respondedAt=new Date().toISOString()` al persistir `response`.

## UI

- Bloque de Reviews (F1) y badges multi-canal (F3) consumen este endpoint.
- Settings → "Reseñas" (pestaña existente, ya tiene el panel de moderación):
  - Al responder una reseña desde el panel admin, el frontend ya recibe `respondedAt`.
  - Nueva sección **"Visibilidad pública"** con 2 toggles:
    - "Mostrar puntaje promedio en la web pública" → `publishReviewScore`.
    - "Mostrar comentarios de huéspedes en la web pública" → `publishReviewComments`.
  - Estado default: ambos OFF. El admin debe activar explícitamente (la UI muestra un
    warning: "Mientras esté apagado, las reseñas recolectadas no se muestran al público").
- Preview: botón "Ver en la web pública" abre `/h/:slug#reviews` (F1 landing).
