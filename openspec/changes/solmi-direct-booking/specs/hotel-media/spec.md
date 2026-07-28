# Hotel Media Specification (F0)

## Purpose

Construir el sistema de fotos y galería del hotel (hero, gallery, fotos por habitación)
que HOY no existe — el modelo `Hotels` solo tiene `logo` (subido via
`hoteles/controller.ts:81 uploadLogo` → `storage.upload('hotel-logos')`). Toda la
información visual que una landing de reservas necesita (hero banner, galería de fotos,
fotos por tipo de habitación) está ausente. F1 (landing configurable) y F2 (widget)
requieren `hotel_media` para rendir.

Módulo NUEVO `hotel-media` con tabla `hotel_media`, CRUD admin + upload via S3 (reusando
`S3StorageAdapter` existente en `backend/src/infrastructure/storage/s3-adapter.ts:31`),
endpoint público agrupado.

Equivalente MisterPlan: "Galería de fotos" del módulo Web Directa.

## Requirements

### Requirement: Tres tipos de media

El sistema MUST soportar 3 tipos de media, distinguibles por el campo `type`:
- `hero` — imagen principal para el hero banner de la landing (1-N).
- `gallery` — fotos generales del hotel (lobby, exterior, amenities).
- `room` — foto(s) de un tipo de habitación específico (FK `roomId`).

Cada media tiene 1 URL, 1 `alt` (accesibilidad), 1 `sortOrder`.

#### Scenario: Subir hero

- GIVEN admin del hotel
- WHEN sube `POST /api/hotel-media {type:'hero', url:'data:...', alt:'Fachada del hotel'}`
- THEN se persiste la fila, la URL se resuelve a un path `hotel-media/<hotelId>/<uuid>.<ext>`
  en S3 (no data: URL en DB)

#### Scenario: Subir foto de habitación vincula a room

- GIVEN admin del hotel con habitación `roomId='abc'`
- WHEN sube `POST /api/hotel-media {type:'room', roomId:'abc', url:'...', alt:'Habitación doble'}`
- THEN la fila persiste con `roomId='abc'`; GET público devuelve la foto dentro del array
  de esa habitación

### Requirement: Orden explícito por tipo

Dentro de cada `type`, las media MUST tener `sortOrder` entero y consecutivo sin gaps.
El admin reordera via drag-and-drop → `POST /api/hotel-media/reorder {ids: [...]}`.

#### Scenario: Reordenar gallery

- GIVEN gallery con 3 fotos A (sortOrder=0), B (1), C (2)
- WHEN admin drag C al primer lugar → `POST /reorder {ids:['C','A','B']}`
- THEN los sortOrder quedan C=0, A=1, B=2 (sin gaps, escrito atómico)

### Requirement: Ownership por hotelId

Toda operación MUST verificar que la media pertenece al hotel del usuario autenticado
(`auth.assertOwnership(...)` post-`findOne`). Misma regla para `roomId` referenciado —
debe pertenecer al hotel.

#### Scenario: Editar media de hotel ajeno

- GIVEN admin del hotel X
- WHEN intenta `DELETE /api/hotel-media/:id` donde la media es del hotel Y
- THEN responde 400 (`"La media no existe o es de otro hotel"`)
- WHEN intenta `POST /api/hotel-media {type:'room', roomId:'<room-del-hotel-Y>', ...}`
- THEN el usecase valida `room.hotelId === user.hotelId` y responde 400

### Requirement: Endpoint público agrupado

El endpoint público `GET /api/public/hotels/:slug/media` MUST devolver las media agrupadas
por `type`, sin requerir auth, rate-limited.

#### Scenario: GET público

- GIVEN hotel con 2 hero, 5 gallery, y 2 habitaciones con 3 fotos cada una
- WHEN `GET /api/public/hotels/caribe-paradise/media`
- THEN responde `{hero: [...2], gallery: [...5], rooms: [{roomId, roomName, photos: [...3]}, ...2]}`

### Requirement: Reuso del adapter S3, NO nuevo storage

El upload MUST usar `S3StorageAdapter` ya existente (`s3-adapter.ts:31`), con directorio
`hotel-media/` (paralelo a `hotel-logos/`). Recibe base64 data-URL en el body (mismo
patrón que `uploadLogo`), el service lo parsea (`parseDataUrl`) y sube.

#### Scenario: Subida con adapter S3

- GIVEN hotel en prod (B2 configurado via env `B2_*`)
- WHEN admin sube una foto de 2MB
- THEN la URL pública en DB es `https://<B2_PUBLIC_BASE_URL>/hotel-media/<hotelId>/<uuid>.jpg`
  (no base64 en DB, no archivo local)

## Database

- **NEW TABLE** `hotel_media`

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK a `hotels.id`, multi-tenant |
| `type` | string | REQUIRED | Enum: `'hero'` \| `'gallery'` \| `'room'`. Validado server-side. |
| `url` | string | REQUIRED | URL pública en S3 (post-upload). |
| `alt` | string | nullable | Texto alternativo accesibilidad. |
| `sortOrder` | integer | default 0 | Entero dentro del `(hotelId, type)`. |
| `roomId` | TEXT | nullable | FK a `rooms.id`. REQUIRED si `type='room'`. |
| `createdAt` | datetime | REQUIRED | Timestamp ORM. |
| `updatedAt` | datetime | REQUIRED | Timestamp ORM. |

Índices: `(hotelId, type, sortOrder)` para listar ordenado rápido; `(roomId)` para el
endpoint de habitaciones.

Anti-patrón ORM (D5): todas las columnas declaradas en
`orm.define('HotelMedia', ...)` dentro de `registerHotelMediaModels(orm)`.

## API

### Admin (con `auth.authenticate('merchant')` + permiso `media:view|edit`)

- `GET /api/hotel-media?type=hero|gallery|room` — lista media del hotel del usuario, opcional filtro type.
- `POST /api/hotel-media` — crear: body `{type, url (base64 or http), alt?, roomId?, sortOrder?}`.
  Schema validator: `type` enum required, `url` required, `alt` string, `roomId` string,
  `sortOrder` integer.
- `PUT /api/hotel-media/:id` — actualizar `alt`, `sortOrder`, `roomId`.
- `DELETE /api/hotel-media/:id` — borrar (y delete del objeto S3 correspondiente via adapter).
- `POST /api/hotel-media/reorder` — body `{ids: [...]}` reordena atómico dentro de type.

### Pública (sin auth, rate-limited)

- `GET /api/public/hotels/:slug/media` — devuelve:
```json
{
  "hero": [{id, url, alt}],
  "gallery": [{id, url, alt}],
  "rooms": [{roomId, roomName, photos: [{id, url, alt}]}]
}
```

## UI

- En la pestaña **"Página pública"** de Settings (junto con F0 public-hotel-info), sección
  **"Media"** con 3 columnas:
  - **Hero** (drop zone para 1-N fotos, reordenable).
  - **Galería** (grid de fotos, drag-and-drop reorder, eliminar).
  - **Por habitación** (selector de habitación arriba, drop zone abajo).
- Upload UI: drag-and-drop con preview, alt text input por foto, validación de tamaño
  (max 5MB por foto, formato JPG/PNG/WebP).
- Preview: cada foto muestra su `sortOrder` y un botón de eliminar con confirm.
- Foto "principal" de cada tipo: la primera en `sortOrder` (badge "Principal" visible).
