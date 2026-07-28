# Booking Widget Specification (F2)

## Purpose

Construir el **widget SPA-first** unificado que consolida/reemplaza LOS 2 widgets
duplicados existentes (ambos verificados en código, D-15):

- **(a) Vue `/book/:slug`** — `frontend/src/pages/booking-widget/index.vue`. Botón
  "Confirmar Reserva" que NO cobra (solo crea reserva pendiente, D-1).
- **(b) Widget estático embebible** — `frontend/public/widget/` (6 archivos:
  `index.html`, `booking.js`, `loader.js`, `ga4.js`, `api.js`, `styles.css`).
  Servido por Vite en `/widget/index.html` y embebible en sitios externos vía
  el snippet `<script src="/widget/loader.js">`. También tiene el pago desconectado.

Ambos widgets duplican propósito y AMBOS quedan fuera de operación tras F2. El nuevo
widget es multi-step (search → rooms → upsells → guest checkout → pay → confirm),
reusa las tarifas derivadas (RoomRates/Seasons existentes), soporta promo codes,
urgencia REAL con dato vivo del PMS, calendar estilo Airbnb, i18n ES/EN/PT, y
multi-moneda con geo-IP. El loader embebible para sitios externos se genera del
mismo bundle SPA (router decide layout), no de archivos sueltos en `public/`.

Objetivo cuantitativo: **Lighthouse mobile Performance ≥ 90** (sub-2s en 4G). Equivalente
MisterPlan: motor de reservas directo tipo Airbnb/Booking pero nativo del PMS.

## Requirements

### Requirement: 6 steps multi-paso

El widget MUST implementar 6 steps secuenciales con state machine (`useBooking.ts`):
1. **Search** — checkIn/checkOut (calendar), guests, rooms.
2. **Rooms** — room types disponibles con "From $X" + member rate + upsells.
3. **Upsells** — desayuno, transfer, late checkout (opcionales).
4. **Guest checkout** — datos del huésped (NO requiere cuenta).
5. **Pay** — redirect a Stripe Checkout.
6. **Confirm** — estado post-redirect.

#### Scenario: Flujo end-to-end

- GIVEN huésped entra a `/book/:slug`
- WHEN completa los 6 steps
- THEN crea la reserva, redirect a Stripe, paga, vuelve a confirm

### Requirement: SPA-first sub-2s

El widget MUST cargar en <2s en mobile 4G (Lighthouse Performance ≥ 90). Estrategias:
- Code-splitting por step (cada step se carga lazy al llegar).
- Sin librerías pesadas en el bundle inicial.
- Imágenes lazy-load.
- Tracking deferred (server-side, F3).

#### Scenario: Lighthouse audit

- GIVEN `/book/:slug` deployado
- WHEN corre Lighthouse mobile
- THEN Performance ≥ 90, First Contentful Paint < 1.5s, Time to Interactive < 2s

### Requirement: Tarifas derivadas + impuestos desglosados

El step Rooms MUST mostrar el precio derivado de `RoomRates`/`Seasons` (módulo
`channel-manager` ya lo computa) para las fechas seleccionadas. El precio mostrado
MUST incluir desglose: `tarifa + ITBIS (18%) = total`.

#### Scenario: Tarifa con ITBIS

- GIVEN hotel con `taxRate=18`, tarifa base 100 DOP/noche, 3 noches
- WHEN usuario selecciona 3 noches en calendar
- THEN RoomsStep muestra "From $354 total ($100 × 3 + $54 ITBIS)"

### Requirement: Member rate opcional

El widget MAY mostrar "Member rate" (precio con descuento para login). Pero NUNCA MUST
forzar cuenta — el flujo de guest checkout anónimo es REQUIRED.

#### Scenario: Usuario sin cuenta reserva igual

- GIVEN huésped sin cuenta SOLMI
- WHEN completa el widget sin login
- THEN puede reservar y pagar sin crear cuenta (solo email + nombre)

### Requirement: Promo codes funcionales

El widget MUST aceptar promo codes en el step Pay. Valida contra `promo_codes` (F2 2.1).
Aplica descuento (% o fijo) sobre el subtotal, antes de impuestos. NO stackeable (un
promo por reserva).

#### Scenario: Promo válido aplica

- GIVEN hotel con promo code `WELCOME10` (kind='percent', value=10, maxUses=100, uses=5)
- WHEN usuario ingresa `WELCOME10` en step Pay con subtotal $300
- THEN la UI muestra "Descuento: -$30 (10%)" y el total baja a $270 + ITBIS sobre $270

#### Scenario: Promo vencido rechazado

- GIVEN promo `WELCOME10` con `validTo='2025-01-01'` (pasado)
- WHEN usuario ingresa `WELCOME10` hoy (2026)
- THEN la UI muestra error "Código vencido" y NO aplica descuento

#### Scenario: Promo agotado

- GIVEN promo con `maxUses=100, uses=100`
- WHEN usuario ingresa el code
- THEN error "Código agotado"

### Requirement: Urgencia REAL (no falsa)

Si `availableCount` para el room type en las fechas seleccionadas es ≤3, el widget MUST
mostrar badge "Pocas habitaciones a este precio". Si ≤1, "Última disponible". Si >3,
NO se muestra badge (no falsificar urgencia — destruye confianza).

#### Scenario: 2 habitaciones left

- GIVEN room type "Doble" con `availableCount=2` para las fechas seleccionadas
- WHEN usuario ve RoomsStep
- THEN badge "Pocas habitaciones a este precio" visible

#### Scenario: 5 habitaciones left, sin badge

- GIVEN room type con `availableCount=5`
- WHEN RoomsStep renderiza
- THEN NO aparece badge (no engañar al usuario)

### Requirement: Calendar estilo Airbnb, selección inclusiva

Calendar view con selección por drag de N celdas = N noches. Checkout = último día + 1
(respetando mem `planning-calc-inclusive-selection-static-refs`). Totales son `computed`
(reactivos), no `ref` fijo que se desincroniza.

#### Scenario: 3 noches

- GIVEN usuario drag desde 2026-08-01 hasta 2026-08-03 (3 celdas)
- THEN noches = 3, checkout = 2026-08-04, total = 3 × nightlyRate

### Requirement: i18n ES/EN/PT con fallback

El widget MUST soportar 3 idiomas. Default = `navigator.language`. Switcher en header.
Traducción faltante → fallback ES (mismo patrón que F0 public-hotel-info con
`resolveForLang`).

### Requirement: Multi-moneda con geo-IP

El widget MUST soportar display multi-moneda. Default por geo-IP (cabecera
`CF-IPCountry` en prod, fallback a `hotels.currency`). Conversión via rates cacheados
(`configuration(key='currency_rates')`, updateados por cron daily). Display only — el
cobro SIEMPRE es en `hotels.currency`.

#### Scenario: Hotel en DOP, usuario en EU

- GIVEN hotel con `currency='DOP'`, usuario con `CF-IPCountry='FR'`
- WHEN carga el widget
- THEN precios en EUR (convertidos); al pagar, Stripe cobra en DOP

### Requirement: CTA "Ver disponibilidad" no "Reservar"

El CTA desde la landing (F1) hacia el widget MUST ser **"Ver disponibilidad"** (no
"Reservar") — reduce fricción al no comprometer al usuario antes de ver precios.

### Requirement: Recovery post-redirect

Tras pagar en Stripe, el redirect vuelve a `/h/:slug?booking=:id&token=:token`. La
página de confirmación (F3 3.17) muestra estado y permite recuperar la reserva via
`GET /api/public/reservations/:id?token=X`.

#### Scenario: Volver a la reserva desde email

- GIVEN huésped recibió email con link
- WHEN click `/h/:slug?booking=:id&token=:token`
- THEN ve su reserva confirmada con detalles + wallet pass + código TTLock

### Requirement: Reemplaza AMBOS widgets existentes

El nuevo componente `frontend/src/pages/public/booking-widget.vue` reemplaza LOS 2
widgets existentes (D-15):

- **(a)** `frontend/src/pages/booking-widget/index.vue` (Vue `/book/:slug`) — eliminado.
- **(b)** `frontend/public/widget/` (widget estático embebible: los 6 archivos) — eliminado.

La ruta `/book/:slug` apunta al nuevo widget SPA. El loader embebible para sitios
externos se genera del MISMO bundle SPA que la landing `/h/:slug` y el widget
`/book/:slug`, NO de archivos sueltos en `public/widget/`. Sin duplicación.

#### Scenario: Vue widget viejo eliminado

- GIVEN `/book/:slug` cargaba `pages/booking-widget/index.vue`
- WHEN se deploya F2
- THEN `pages/booking-widget/index.vue` no existe; `/book/:slug` carga
  `pages/public/booking-widget.vue`

#### Scenario: Widget estático eliminado

- GIVEN `frontend/public/widget/` con 6 archivos existía pre-F2
- WHEN se deploya F2
- THEN `ls frontend/public/widget/` no existe; `grep -r 'public/widget' frontend/`
  devuelve 0 hits (salvo el `loader.js` shim si se elige Opción A de retrocompat).

#### Scenario: Retrocompat del snippet loader.js embebido

- GIVEN sitios externos tenían embebido el snippet `<script src="/widget/loader.js">`
- WHEN se deploya F2
- THEN EITHER (a) el nuevo loader shim responde en la misma URL `/widget/loader.js` y
  renderiza el nuevo widget SPA en el iframe (Opción A — sin acción del hotel), OR
  (b) el snippet viejo devuelve 404 y se documenta como breaking change en changelog
  con instrucciones de migración al nuevo endpoint (Opción B — decisión en F2 2.13).

## Database

- **NEW TABLE** `promo_codes` (modulo `promo-codes`)

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK `hotels.id`. |
| `code` | string | REQUIRED | Upper-case. Unique `(hotelId, code)`. |
| `kind` | string | REQUIRED | Enum `'percent'` \| `'fixed'`. |
| `value` | number | REQUIRED | Porcentaje (0-100) o monto fijo en `currency`. |
| `minAmount` | number | nullable | Subtotal mínimo requerido. |
| `maxUses` | integer | nullable | NULL = ilimitado. |
| `uses` | integer | default 0 | Incrementa al aplicarse exitosamente. |
| `validFrom` | datetime | nullable | |
| `validTo` | datetime | nullable | |
| `active` | boolean | default 1 | |
| `createdAt`, `updatedAt` | datetime | REQUIRED | |

- **NEW TABLE** `upsells` (módulo `booking-engine`, sub-dominio)

| Column | Type | Nullability | Notes |
|---|---|---|---|
| `id` | TEXT (uuid) | REQUIRED PK | |
| `hotelId` | TEXT | REQUIRED | FK `hotels.id`. |
| `name` | string | REQUIRED | Ej. "Desayuno buffet". |
| `description` | string | nullable | |
| `price` | number | REQUIRED | En `currency`. |
| `kind` | string | REQUIRED | Enum `'per_room'` \| `'per_person'` \| `'per_stay'`. |
| `active` | boolean | default 1 | |
| `sortOrder` | integer | default 0 | |
| `createdAt`, `updatedAt` | datetime | REQUIRED | |

Anti-patrón ORM (D5): todas las columnas declaradas en sus `orm.define(...)`.

## API

### Públicos (sin auth, rate-limited)

| Method | Path | Body / Query | Resp |
|---|---|---|---|
| GET | `/api/public/hotels/:slug/rates` | `?checkIn=&checkOut=&rooms=&guests=&currency=` | `{roomTypes:[{id,name,fromPrice,availableCount,taxBreakdown}], currency, taxes}` |
| GET | `/api/public/hotels/:slug/upsells` | — | `[{id,name,description,price,kind}]` |
| POST | `/api/public/booking` | `{guest, roomId, checkIn, checkOut, upsells:[{id,qty}], promoCode?}` | `{reservationId, accessToken, checkoutUrl, totalBreakdown}` |

### Admin (auth + permiso)

- `GET/POST/PUT/DELETE /api/promo-codes[/:id]` — CRUD promo codes.
- `GET/POST/PUT/DELETE /api/booking-engine/upsells[/:id]` — CRUD upsells.

## UI

### Componentes Vue (`frontend/src/components/booking/`)

- `SearchStep.vue` — calendar + guests + rooms selector. Botón "Buscar disponibilidad".
- `RoomsStep.vue` — lista de room types disponibles con tarifa + upsell badge (D11 urgencia).
- `UpsellsStep.vue` — checkboxes de upsells opcionales, qty selector.
- `GuestCheckoutStep.vue` — form datos huésped (nombre, email, teléfono, notas). SIN
  login. Botón "Continuar al pago".
- `PayStep.vue` — resumen final + input promo code + botón **"Reservar y Pagar"** (D1)
  → redirect a Stripe.
- `ConfirmStep.vue` — estado post-redirect (polling `GET /api/public/reservations/:id`).

### Wrapper (`frontend/src/pages/public/booking-widget.vue`)

- Layout `none`, mobile-first responsive.
- Header con switcher idioma + moneda + nombre del hotel.
- Stepper indicator (1-6) arriba.
- `useBooking` composable orquesta todo.
