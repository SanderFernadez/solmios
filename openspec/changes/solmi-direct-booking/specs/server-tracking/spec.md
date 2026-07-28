# Server Tracking Specification (F3)

## Purpose

Implementar **server-side tracking nativo** (Meta CAPI + GA4 Measurement Protocol
Server-Side + Enhanced Conversions) que NINGÚN booking engine del mercado incluye.
Recupera ~30% de la data perdida por Intelligent Tracking Prevention (ITP), ad-blockers,
y la creciente restricción de cookies. Es uno de los 3 gaps estructurales diferenciales.

Hoy el `usecases/analytics.ts` (`topRoomTypes:[]` vacío — F4 lo reemplaza) NO dispara
eventos server-side. El tracking actual (si existe) es 100% client-side → pierde data
en Safari/Firefox/ad-blockers.

Decisión (D3 en `design.md`): este spec se centra en los 3 fires principales (Meta CAPI,
GA4-SS, Enhanced Conversions) en el momento del webhook confirm. F4 agrega el funnel
analytics completo (view → search → select → form → pay → confirm).

Equivalente MisterPlan: no tiene tracking server-side nativo — esta feature supera el
benchmark.

## Requirements

### Requirement: Meta CAPI fire al confirmar

Cuando el webhook Stripe confirma la reserva, el sistema MUST disparar
`POST https://graph.facebook.com/v18.0/{pixel_id}/events` con:
- `event_name: 'Purchase'`.
- `event_id: <reservationId>` (REQUIRED para dedup con client-side Pixel).
- `event_time: <unix>`.
- `action_source: 'system'` (server-side, no 'website').
- `user_data` con email y phone **hashed** (Enhanced Conversions — ver requirement abajo).
- `value`, `currency`, `content_type: 'hotel'`, `content_ids: [roomId]`.
- `opt_in: true` (consentimiento explícito del huésped en el form).

Si `meta_capi_token` o `meta_pixel_id` no configurados → skip silencioso (no falla).

#### Scenario: Fire con creds configuradas

- GIVEN hotel con `meta_pixel_id` + `meta_capi_token`, reserva confirmada con email+phone
- WHEN webhook confirma
- THEN POST a Meta Graph API con payload correcto, response 200 + `event_id` persistido

#### Scenario: Skip sin creds

- GIVEN hotel sin `meta_pixel_id`
- WHEN webhook confirma
- THEN NO se dispara nada a Meta, log info "meta_capi skipped: not configured"

### Requirement: GA4 Measurement Protocol Server-Side fire

El sistema MUST disparar `POST https://www.google-analytics.com/mp/collect?measurement_id=X&api_secret=Y`
con:
- `client_id`: AnonymousID del navegador (enviado desde el frontend en la request inicial).
- `events: [{name: 'purchase', params: {transaction_id: reservationId, value, currency,
  items: [{item_id: roomId, item_name: roomName, item_category: 'hotel', price, quantity}]} }]`.

Si `ga4_measurement_id` o `ga4_api_secret` no configurados → skip silencioso.

#### Scenario: GA4 fire

- GIVEN hotel con GA4 creds
- WHEN webhook confirma con `client_id` propagado desde el form
- THEN POST a GA4 MP con payload correcto, response 204

### Requirement: Enhanced Conversions (hashed PII)

Para Meta CAPI, los campos `email` y `phone` MUST hashearse con SHA256 (lowercase, sin
espacios, sin `+` en phone) antes de enviar. NUNCA enviar PII en claro a Meta/Google
server-side.

#### Scenario: Hash correcto

- GIVEN huésped con `email='Juan.Perez@Example.com'`, `phone='+1 809 555 0000'`
- WHEN el usecase compute el hash
- THEN `em = sha256('juan.perez@example.com')`, `ph = sha256('18095550000')` (normalizado
  a E.164 sin `+` ni espacios)

### Requirement: Deduplication event_id

El `event_id` (`reservationId`) MUST ser el MISMO en el fire server-side Y en el fire
client-side (si Meta Pixel está instalado en el frontend). Meta deduplica automáticamente
eventos con mismo `event_id` (no cuenta 2× la conversión).

#### Scenario: Pixel client-side + CAPI server-side

- GIVEN frontend con Meta Pixel instalado, backend con CAPI
- WHEN webhook confirma
- THEN el frontend disparó `fbq('track', 'Purchase', {...}, {eventID: reservationId})` y
  el backend disparó CAPI con `event_id: reservationId` — Meta Events Manager muestra 1
  evento (no 2)

### Requirement: Persistencia de eventos para auditoría

Cada fire (Meta, GA4) MUST persistir en `tracking_events` con:
- `event`, `hotelId`, `reservationId`, `anonymousId`, `meta` (payload), `status`
  (`sent`/`failed`/`skipped`), `errorMessage` (si falla), `timestamp`.

Esto permite auditar qué se disparó, diagnosticar perdidos, y reintentar fallidos.

#### Scenario: Auditoría

- GIVEN reserva confirmada con Meta+GA4 disparados
- WHEN admin abre Settings → Tracking → "Ver historial"
- THEN ve 2 filas en `tracking_events` (`event:'purchase'`, status `sent`, timestamps)

### Requirement: Test mode para dev

El admin MUST poder setear `meta_test_event_code` (Meta test code, formato `<16-char>`)
para mandar events a Meta Events Manager en modo test (no cuenta como conversión real).
Sin esto, dev/staging contamina las métricas de producción Meta.

#### Scenario: Test event en dev

- GIVEN hotel con `meta_test_event_code='ABC123...'` (dev)
- WHEN webhook confirma
- THEN el payload a Meta incluye `test_event_code: 'ABC123...'`, el evento aparece en Meta
  Events Manager > Test Events, NO en prod metrics

### Requirement: Opt-in explícito del huésped

El widget (F2) MUST incluir checkbox en GuestCheckoutStep: "Acepto recibir comunicaciones
y compartir mis datos para fines de marketing (opcional)". Si no checkea, NO se dispara
Enhanced Conversions (los hashes PII no se mandan) — solo el evento sin `user_data` o
con `user_data` vacío.

#### Scenario: Usuario rechaza consentimiento

- GIVEN huésped no checkea el opt-in
- WHEN webhook confirma
- THEN el fire Meta va con `user_data: {}` (sin hashes), GA4 sin `client_id` específico
  (usa un client_id genérico del navegador)

### Requirement: Rate-limit / queue

Si muchas reservas confirman a la vez (peak), los fires MUST encolarse (no bloquear el
webhook). El webhook solo persiste el `tracking_events` con `status='pending'`, un worker
async dispara los fires. Si el worker cae, los events quedan `pending` y se reintenta.

#### Scenario: Pico de confirmaciones

- GIVEN 50 webhooks confirmando a la vez
- WHEN el webhook termina
- THEN los 50 webhook responden rápido (<200ms) con la reserva `confirmed`, los 100 fires
  (50 Meta + 50 GA4) se procesan async encolados

## Database

- **NEW TABLE** `tracking_events` (módulo `server-tracking`)

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK `hotels.id`, multi-tenant. |
| `event` | string | REQUIRED | Enum `'view'` \| `'search'` \| `'select'` \| `'upsell'` \| `'form'` \| `'pay'` \| `'confirm'` \| `'abandon'`. |
| `anonymousId` | string | nullable | Client-side ID para dedup. |
| `reservationId` | TEXT | nullable | FK `reservations.id`, seteado post-confirm. |
| `meta` | json | nullable | Payload disparado (para auditoría). |
| `target` | string | REQUIRED | Enum `'meta'` \| `'ga4'` \| `'internal'`. |
| `status` | string | REQUIRED | Enum `'pending'` \| `'sent'` \| `'failed'` \| `'skipped'`. |
| `errorMessage` | string | nullable | Si status `failed`. |
| `timestamp` | datetime | REQUIRED | |
| `createdAt`, `updatedAt` | datetime | REQUIRED | |

INDEX `(hotelId, event, timestamp)` para queries de funnel. INDEX `(status, timestamp)`
para el worker buscar pendientes.

Anti-patrón ORM (D5): todas las columnas declaradas en `orm.define('TrackingEvent', ...)`.

## API

### Interno

- Worker async procesa `tracking_events` con `status='pending'` cada 30s.
- Cron reintenta `failed` cada 5min (max 3 retries).

### Admin (auth + permiso `tracking:view`)

- `GET /api/server-tracking/config` — devuelve config actual (creds mascaradas).
- `PUT /api/server-tracking/config` — guarda creds.
- `POST /api/server-tracking/test-fire` — dispara evento test (devuelve response de Meta/GA4).
- `GET /api/server-tracking/events?reservationId=X` — historial por reserva.

## UI

### Settings → "Tracking y conversión" (nueva sub-pestaña)

- 3 secciones:
  - **Meta CAPI**: inputs `meta_pixel_id`, `meta_capi_token`, `meta_test_event_code` (dev).
    Botón "Test fire" (dispara evento test).
  - **GA4 Server-Side**: inputs `ga4_measurement_id`, `ga4_api_secret`.
    Botón "Test fire".
  - **Enhanced Conversions**: explicación + checkbox "Habilitar hashing de PII" (default on).
- Status panel: "Últimos 10 fires" con timestamp + status + link al detalle.

### Widget (F2) checkbox consentimiento

En `GuestCheckoutStep.vue`, checkbox:
> "Acepto recibir comunicaciones y compartir mis datos para fines de marketing (opcional)"

Si no checkea → `opt_in=false` se propaga al backend en la request `POST /api/public/booking`,
y el webhook NO dispara Enhanced Conversions (solo evento sin PII).

## Auth flow (REQUIRED — design rule)

### Meta CAPI

1. Hotel dueño crea Meta Business + Pixel (si no tiene).
2. Genera Long-Lived Access Token con permiso `ads_management` o `business_management`.
3. Pega pixel_id + token en Settings.
4. SOLMI OS llama `POST https://graph.facebook.com/v18.0/{pixel_id}/events?access_token={token}`
   con payload.
5. Para test: `test_event_code` en el payload → Meta Events Manager > Test Events tab.

### GA4 Measurement Protocol v2

1. Hotel dueño crea GA4 property + data stream (Web).
2. Admin → Data Streams → "Measurement Protocol API secrets" → create secret.
3. Pega measurement_id (format `G-XXXXXXX`) + api_secret en Settings.
4. SOLMI OS llama `POST https://www.google-analytics.com/mp/collect?measurement_id={id}&api_secret={secret}`
   con payload JSON.
5. Para ver eventos: GA4 > Realtime > Events (delay 30s-1min).
