# Booking Unification Specification (F0)

## Purpose

El módulo `bookingengine` corre **2 flujos paralelos** que escriben a tablas distintas:
- `POST /api/public/booking` (singular) → `Reservations` (operacional, verificado en
  `usecases/public-booking.ts:65`). Crea reserva + guest con `source:'direct'`,
  `status:'pending'`.
- `POST /api/public/bookings` (plural) → `public_bookings` (tabla HUÉRFANA — ninguna
  query del dashboard la lee, verificado). Repos `BookingEngine`/`PublicBookingModel`
  en `model.ts:68-90`.

El `StripeUseCase` (pago) opera SOBRE `public_bookings` (el flujo plural), pero el UI
del widget (`booking-widget/index.vue:240`) posta al flujo SINGULAR (`/public/booking`).
Resultado verificado: **el endpoint de Stripe Checkout existe pero el UI no lo llama
nunca** (disconnect D-1/D-2), y aunque se cablee, **no funciona** porque Opera sobre la
tabla equivocada vs donde el UI escribe.

Además, `GET /api/public/bookings/:id` tiene **IDOR abierto** marcado `@ignore`
(`usecases/booking.ts:50-55`) — sin ownership check, cualquiera con un UUID lee cualquier
reserva pública.

Este spec consolida ambos flujos en `Reservations` como única fuente, reescribe Stripe
para operar sobre `Reservations`, cablea el pago al botón del widget, y cierra el IDOR
con access token.

**Riesgo ALTO** — rollback plan OBLIGATORIO (al final del spec y en `design.md` R1).

Equivalente MisterPlan: motor de reservas directo (MisterPlan no tiene este problema de
doble flujo; este spec alinea SOLMI con esa simplicidad).

## Requirements

### Requirement: Una sola fuente de verdad: `Reservations`

Todo booking público MUST escribir en la tabla operacional `Reservations`. El flujo
plural `/public/bookings` (→ `public_bookings`) se elimina. Las reservas creadas por el
flujo unificado tienen `source:'direct'`, `status:'pending'`,
`paymentStatus:'unpaid'` (hasta que el webhook Stripe las confirme).

#### Scenario: Crear reserva vía flujo unificado

- GIVEN huésped en el widget con datos válidos
- WHEN `POST /api/public/booking {guest, roomId, checkIn, checkOut, ...}`
- THEN se crea una fila en `Reservations` con `source='direct'`, `status='pending'`,
  `paymentStatus='unpaid'`, `accessToken` (UUID), y devuelve 201 con `{reservationId,
  accessToken, checkoutUrl}`

#### Scenario: Flujo plural rechazado (deprecation)

- GIVEN feature flag `BOOKING_USE_UNIFIED_FLOW=true`
- WHEN `POST /api/public/bookings {...}`
- THEN responde 410 Gone con `{error: 'Deprecated. Use POST /api/public/booking'}` y log
  de deprecation

### Requirement: Access token público para IDOR

Toda reserva creada por flujo público MUST recibir un `accessToken` (UUID). La consulta
pública `GET /api/public/reservations/:id?token=X` valida `hash(token)` contra el
almacenado. Sin token, token incorrecto, o reserva creada desde panel (sin accessToken)
→ 404 (no revelar existencia).

#### Scenario: Consulta con token válido

- GIVEN reserva creada por flujo público con `accessToken='abc-123'`
- WHEN `GET /api/public/reservations/:id?token=abc-123`
- THEN responde 200 con `{reservation, guest, paymentStatus, ...}`

#### Scenario: Consulta sin token o con token incorrecto

- GIVEN la misma reserva
- WHEN `GET /api/public/reservations/:id` (sin token) o `?token=wrong`
- THEN responde 404 (mismo body que si la reserva no existiera, para no revelar)

#### Scenario: Reserva creada desde panel no es pública

- GIVEN reserva creada por recepcionista via `/api/panel/reservas` (flujo interno)
- WHEN `GET /api/public/reservations/:id?token=cualquiera`
- THEN responde 404 (la reserva tiene `accessToken=null`)

### Requirement: Stripe sobre Reservations, con idempotency key

El `StripeUseCase` MUST reescribirse para operar sobre `repo('Reservations')` (NO sobre
`repo('BookingEngine')`). El `gw.createCharge` MUST pasar `idempotency_key: reservationId`
(hoy NO se pasa, verificación §7). El webhook `handleStripeWebhook` MUST actualizar la
fila en `Reservations` (`paymentStatus='paid'`, `status='confirmed'`).

#### Scenario: Crear Checkout Session

- GIVEN reserva pending con `accessToken='abc'`
- WHEN `POST /api/public/reservations/:id/checkout` (con token válido)
- THEN el backend llama `gw.createCharge({amount, currency, reference: reservationId,
  idempotency_key: reservationId})` y devuelve `{checkoutUrl, sessionId}`

#### Scenario: Webhook confirma sin doble-cobro

- GIVEN reserva pending, payment event ya procesado
- WHEN Stripe reenvía el mismo webhook (reintentos)
- THEN `PaymentEventStore.settleOnce(hotelId, 'stripe', eventId)` devuelve `'duplicate'`,
  NO se actualiza la reserva de nuevo, NO se generan códigos TTLock duplicados, NO se
  manda email duplicado

### Requirement: Botón "Reservar y Pagar" redirige a Stripe

El widget actual tiene un botón **"✓ Confirmar Reserva"** (`booking-widget/index.vue:143`)
que crea la reserva y muestra modal de éxito sin cobrar. F0 MUST reemplazarlo por un
botón **"Reservar y Pagar"** que, tras crear la reserva pending, redirect a `checkoutUrl`
(Stripe Checkout, off-site).

#### Scenario: Botón dispara redirect

- GIVEN huésped completó los 5 steps del widget (F2)
- WHEN click "Reservar y Pagar"
- THEN el frontend hace `POST /api/public/booking`, recibe `{checkoutUrl}`, y
  `window.location = checkoutUrl` (redirect a Stripe)

#### Scenario: Volver de Stripe

- GIVEN huésped pagó en Stripe
- WHEN Stripe redirect a `success_url=/h/:slug?booking=:id&token=:token`
- THEN la página de confirmación (F3 3.17) muestra estado `confirmed` + wallet pass + TTLock code

### Requirement: Job de migración copia public_bookings huérfanas

Antes de eliminar la tabla `public_bookings`, un job idempotente MUST migrar sus filas a
`Reservations` (si las hay) preservando el pago (si estaba confirmado).

#### Scenario: Migrar booking huérfano

- GIVEN `public_bookings` con 3 filas (2 pagas, 1 pendiente)
- WHEN corre `migrate-public-bookings.ts`
- THEN se crean 3 filas en `Reservations` con `source:'direct'`,
  `paymentStatus:'paid'|'unpaid'` según el booking original, `accessToken` generado, y
  `configuration('migrated_public_booking_ids')` trackea los IDs ya migrados

#### Scenario: Job idempotente

- GIVEN el job ya corrió
- WHEN se corre de nuevo
- THEN no duplica filas en `Reservations` (los IDs ya están en `migrated_public_booking_ids`)

## Database

- **MODIFIED TABLE** `reservations` (modelo `ReservationModel`)

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `accessToken` | TEXT | nullable | UUID generado al crear por flujo público. Null si creada desde panel. Usado para IDOR fix. |

**Anti-patrón ORM (D5)**: `accessToken` declarado en `orm.define('Reservations', ...)`.

- **UNCHANGED TABLE** `public_bookings` — NO se dropea en F0 (rollback safety). Se
  dropea en un change posterior cuando telemetría confirma 0 uso del flujo plural.

## API

### Nuevos / modificados

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/public/booking` | ninguno (rate-limited) |AMPLIADO: devuelve `{reservationId, accessToken, checkoutUrl}`. |
| GET | `/api/public/reservations/:id` | token-based (`?token=X`) |NUEVO: reemplaza al IDOR. |
| POST | `/api/public/reservations/:id/checkout` | token-based |NUEVO: reemplaza `/public/bookings/:id/checkout`. |
| POST | `/api/public/webhook/stripe/:hotelId` | firma Stripe |SIN CAMBIO de path. Internamente opera sobre `Reservations` en vez de `BookingEngine`. |

### Deprecados (eliminados en F4 o change posterior)

| Method | Path | Estado |
|---|---|---|
| POST | `/api/public/bookings` | 410 Gone behind flag `BOOKING_USE_UNIFIED_FLOW=true`. |
| GET | `/api/public/bookings/:id` (IDOR) | 410 Gone (reemplazado por `/public/reservations/:id`). |
| POST | `/api/public/bookings/:id/checkout` | 410 Gone (reemplazado por `/public/reservations/:id/checkout`). |

## UI

- Widget actual (`booking-widget/index.vue`): botón "✓ Confirmar Reserva" → reemplazado
  por "Reservar y Pagar" (F2 reemplaza el componente entero; F0 solo asegura que el endpoint
  devuelve `checkoutUrl` y el botón redirige).
- Email de confirmación (enviado por webhook Stripe): incluye un link
  `/h/:slug?booking=:id&token=:accessToken` para que el huésped pueda volver a ver su
  reserva sin login.
- Panel admin: sin cambios (las reservas públicas ahora aparecen en el listado operacional
  normal con `source='direct'` — ya lo veían los recepcionistas).

## Rollback Plan (RIESGO ALTO)

1. **Feature flag `BOOKING_USE_UNIFIED_FLOW`** (env, default `false` en prod):
   - `false` → el flujo plural viejo sigue respondiendo como hoy.
   - `true` → el flujo plural responde 410, solo el unificado funciona.
2. **NO dropear `public_bookings` en F0**. La tabla queda. Si F0 rompe en prod, revertir
   el commit + setear `BOOKING_USE_UNIFIED_FLOW=false` restaura el flujo viejo.
3. **Stripe webhook**: el path no cambia (`/api/public/webhook/stripe/:hotelId`), Stripe
   dashboard NO se toca. Internamente cambia la tabla sobre la que opera — si rollback,
   vuelve a `BookingEngine`.
4. **Reservas ya creadas con el flujo unificado** (en la ventana prod-rompe): son filas
   válidas en `Reservations` con `source='direct'`, NO se pierden, son operacionalmente
   válidas. Solo su `accessToken` queda sin uso (nadie lo consulta) hasta que F0 se
   reactive.
5. **`public_bookings` drop**: change POSTERIOR (F4 o uno dedicado), solo cuando
   telemetría confirme 0 requests al flujo plural por 1 ciclo de release.
