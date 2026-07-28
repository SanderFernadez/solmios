# Proposal: SOLMI Direct Booking — motor de reservas público + landing configurable

## Intent

SOLMI OS ya tiene PMS operativo (reservas, habitaciones, folios, pagos, housekeeping,
TTLock) y un módulo `bookingengine` con availability real, reserva directa y Stripe
Checkout + webhook firmado anti-doble-cobro. Pero ese motor está **desconectado de la
UI** (el botón "Confirmar y Pagar" no invoca el checkout), corre en **2 flujos
paralelos** que escriben a tablas distintas (`Reservations` operacional vs
`public_bookings` huérfana), su endpoint público de hotel es un **stub** (devuelve el
slug como nombre), y arrastra un **IDOR abierto** en la consulta pública de reservas.
Paralelamente, el módulo `opiniones` recolecta reseñas post-checkout con token público
pero **no las muestra en ningún lado**, y el schema de hotel es riquísimo (lat/lng,
`descriptionJson` multilingüe, amenities, ITBIS, `accommodationType`, `starRating`,
políticas) pero ningún endpoint público lo expone.

Este change construye el **motor de reservas público + landing page configurable por
hotel** que falta, SPA-first, integrando reseñas, con el objetivo explícito de **superar
a los booking widgets del mercado en 2026** (no solo igualarlos) aprovechando los 3 gaps
estructurales que ningún competidor cubre de forma nativa: reseñas multi-canal DENTRO
del widget, server-side tracking nativo, y wallet pass automático al confirmar. El
foundation ahorra ~40% del esfuerzo: el laburo es exponer, cablear y crear lo que
falta — no modelar desde cero.

Equivalente MisterPlan: la suite de "Motor de reservas + Web directa + Reputation" de
MisterPlan es el benchmark competitivo de este change. Donde MisterPlan cubre motor +
web + reseñas internas, este change replica ese piso y agrega los 3 gaps como ventaja
diferencial.

## Scope

### In Scope

- **F0 — Fundación pública**: endpoint público rico `GET /api/public/hotels/:slug`
  (todo el schema del hotel), sistema `hotel_media` (tabla + upload + S3), endpoint
  público de reseñas con aggregate score, unificación de los 2 flujos a `Reservations`
  como única fuente, cablear Stripe Checkout al widget, cerrar IDOR de
  `/public/bookings/:id` con token de acceso devuelto al crear.
- **F1 — Landing configurable**: ruta pública `/h/:slug`, builder por bloques en admin
  (hero, galería, amenities, ubicación/mapa, reseñas, habitaciones "From $X", FAQ, CTA,
  footer con toggle + orden), componentes Vue por bloque, SEO (JSON-LD
  Hotel/LodgingBusiness + AggregateRating + FAQPage + Offer, meta dinámicos, OG,
  sitemap por hotel), mapa Leaflet.
- **F2 — Widget unificado superior**: SPA-first sub-2s mobile 4G, multi-step
  (search → rooms → upsells → guest checkout → pay → confirm), tarifas derivadas
  (RoomRates/Seasons), impuestos desglosados, políticas, promo codes funcionales,
  urgencia REAL con dato vivo del PMS, calendar view estilo Airbnb, i18n ES/EN/PT,
  multi-moneda con geo-IP. Reemplaza los 2 widgets duplicados.
- **F3 — Diferenciadores** (lo que NADIE hace): agregador de reseñas externas
  (GBP + TripAdvisor + StayAPI, cron nightly, cache 24h versionado), reviews
  multi-canal DENTRO del widget, wallet pass auto al confirmar (Apple+Google) +
  integración TTLock, server-side tracking (Meta CAPI + GA4-SS + Enhanced
  Conversions), OTA Price Comparison condicional, abandon recovery email.
- **F4 — Hygiene**: funnel de analytics real reemplazando `topRoomTypes:[]` vacíos,
  availability_cache (borrar o implementar), publishReviewScore/Comments (implementar
  o eliminar del modelo).

### Out of Scope

- **Subdominio por hotel** (`hotel.solmios.com`): decision explícita (ver Decisión 1) —
  `/h/:slug` primero, subdominio queda para iteración posterior con wildcard DNS + SSL.
- **App móvil nativa del booking**: el widget es PWA/SPA responsive, no nativo. El app
  Flutter existente (`solmios-mobile`) es operacional (housekeeping/mantenimiento), no
  de reserva — no se toca.
- **Channel manager bidireccional desde el widget**: la disponibilidad la da el PMS
  (módulo `bookingengine` ya lee `Reservations`); el push a OTAs vive en Channex y no
  se modifica acá.
- **Buscador multi-hotel** (agregador tipo Booking.com): este change es motor de
  reservas **directo por hotel**, no marketplace. Cada hotel tiene su `/h/:slug`.
- **Self check-in completo** (KYC, firma digital): el wallet pass genera el código
  TTLock pero el check-in operativo sigue siendo PMS-side. Se evalúa aparte.

## Approach

Cinco decisiones de arquitectura YA TOMADAS (tomadas con el dueño del producto antes de
este change — estos specs las documentan, no las reabren):

1. **Ruta pública del hotel: `/h/:slug`** — no choca con rutas SaaS existentes
   (`/panel`, `/admin`, `/login`); el subdominio queda para una iteración posterior con
   wildcard DNS + SSL.
2. **1 widget SPA Vue** que sirve como landing `/h/:slug` (landing+widget unificados) Y
   como embebible vía `/book/:slug` compartiendo componentes. El iframe embebible sale
   del mismo bundle. Acaba la duplicación de los 2 widgets actuales (Vue `/book/:slug`
   sin pago + estático `/widget/` sin pago).
3. **Stack agregador reseñas: GBP API (gratis) + TripAdvisor Content API (free con
   backlink) + StayAPI (Booking/Airbnb/Expedia). €0–35/mes.** NO TrustYou/Revinate
   ($125+/mes, solo para cadenas grandes).
4. **Wallet pass en Fase 3, no diferir** + integración con TTLock existente.
5. **Mapa: Leaflet** (gratis, sin API key).

Fases incrementales (F0→F4) por dependencia + ROI. Reglas de compatibilidad:

- F0 es aditivo en su mayor parte (tabla `hotel_media` nueva, endpoint público nuevo,
  columna `media` cache) pero **rompe los 2 flujos paralelos** consolidándolos en
  `Reservations` — requiere rollback plan explícito (ver más abajo).
- F1 es aditivo: tabla `landing_blocks` (configuración por hotel) + nuevas páginas Vue.
- F2 es reemplazo: el widget SPA-first sustituye los 2 widgets existentes (se borran).
- F3 es aditivo puro: tablas `external_reviews`, `wallet_passes`, integraciones externas.
- F4 es cleanup: borrar availability_cache o implementarla; implementar o eliminar
  flags del modelo.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `backend/src/modules/bookingengine/` | Heavy Modified | Unificación de flujos, cablear Stripe al widget, cerrar IDOR, enriquecer `getHotelPublicInfo`, borrar/implem availability_cache |
| `backend/src/modules/hoteles/model.ts` | Modified | Exponer columns públicas vía allow-list (no persistir nada nuevo salvo flags de landing) |
| `backend/src/modules/opiniones/` | Modified | Endpoint público de reseñas + aggregate score + flags `publishReviewScore`/`publishComments` |
| `backend/src/modules/hotel-media/` | New | Módulo nuevo (tabla `hotel_media` + upload + storage S3 reusando adapter) |
| `backend/src/modules/landing/` | New | Módulo nuevo (tabla `landing_blocks`, builder por bloques, orden) |
| `backend/src/modules/public-reviews/` o en `opiniones` | New o Modified | Aggregate score + distribución + paginación pública |
| `backend/src/modules/promo-codes/` | New | Tabla `promo_codes` + validación + aplicación |
| `backend/src/modules/external-reviews/` | New (F3) | Agregador GBP + TripAdvisor + StayAPI, cron nightly |
| `backend/src/modules/wallet-pass/` | New (F3) | Generación Apple+Google pass + integración TTLock |
| `backend/src/modules/server-tracking/` | New (F3) | Meta CAPI + GA4-SS + Enhanced Conversions |
| `backend/src/modules/abandon-recovery/` | New (F3) | Email 1–4h post-abandono |
| `frontend/src/pages/public/` | Heavy Modified + New | `/h/:slug` landing + widget SPA-first unificado |
| `frontend/src/pages/settings/` | Modified | Builder de bloques + upload de media + config reputación |
| `frontend/src/services/` | Modified | `PublicHotel.service.ts`, `Booking.service.ts`, `HotelMedia.service.ts`, etc. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unificación de los 2 flujos de booking rompe reservas huérfanas existentes en `public_bookings` | High | Rollback plan: la tabla `public_bookings` NO se dropea en F0 — se conserva + un job de migración copia las filas a `Reservations` antes de desactivar el flujo plural. Si algo falla, se reactiva el endpoint plural (feature flag) |
| Cablear Stripe Checkout introduce doble-cobro si el webhook llega 2× | Medium | El webhook ya está firmado y dedupea por `stripeEventId` (anti-doble-cobro existente). El cableado de la UI NO reemplaza esa dedup — la complementa con idempotency key en la sesión |
| El endpoint público expone datos sensibles del hotel (email interno, configs) | Medium | Allow-list estricta en el DTO — nunca devolver `internalNotes`, `taxId`, creds. Solo lo que la landing necesita |
| Agregador de reseñas external (F3) rompe si una API de terceros cae | Medium | Cache 24h versionado por fuente + fallback al último agregado conocido (graceful degradation) |
| Wallet pass (F3) requiere certificados Apple Developer ($99/año) | Medium | Documentado en design — el hotel dueño paga su cuenta Apple Developer; Google Pass es gratis |
| Performance del widget SPA-first sub-2s con tantas integraciones (mapa, reseñas, tracking) | Medium | Lazy-load estricto: Leaflet solo cuando el bloque mapa está visible, reseñas lazy, tracking deferred hasta after-confirm |
| SEO: SPA-first complica indexación | Low | SSR/prerender de la landing `/h/:slug` solo (no del widget checkout). Sitemap por hotel + JSON-LD |

## Rollback Plan

Cada fase es independiente y reversible excepto F0 (unificación de flujos) y F2
(reemplazo de widgets):

- **F0 unificación de flujos**: NO dropear `public_bookings` en F0. Mantener ambos
  endpoints activos detrás de un feature flag `BOOKING_USE_UNIFIED_FLOW` (default
  unified). El endpoint plural `/public/bookings` queda deprecado pero funcional por 1
  ciclo de release. Solo después de confirmar 0 uso del flujo viejo (telemetría), se
  elimina la ruta y se dropea la tabla en un change posterior.
- **F2 reemplazo de widgets**: los 2 widgets viejos se borran en la MISMA release que
  introduce el nuevo, pero el nuevo componente comparte lógica con el viejo
  (`useBooking` composable) — si el nuevo falla en producción, revertir el commit
  restaura los 2 viejos sin migración.
- **F1/F3/F4**: aditivos o cleanup. Revertir = dejar de llamar la UI/ruta nueva. F3
  integraciones externas (GBP/TripAdvisor/StayAPI) se desactivan por configuration
  flag por hotel sin code change.

## Dependencies

- **Stripe**: ya conectado (deudas de webhook resueltas en framework 1.6.3 — verificado
  en prod 2026-07-16). F0 solo cablea la UI al endpoint que ya crea Checkout Sessions.
- **TTLock**: ya conectado (auto-generate/send/delete codes). F3 reusa el conector para
  inyectar el código en el wallet pass.
- **S3 / storage adapter**: ya existe para uploads (logo, fotos de housekeeping). F0
  `hotel_media` lo reusa sin crear un adapter nuevo.
- **i18n**: el módulo restaurant ya tiene `usecases/i18n.ts` con patrón de traducciones
  + fallback. F2 lo reusa para ES/EN/PT del widget.
- **CacheAdapter**: ya existe. F3 cache versionado de reseñas externas lo reusa
  (mismo patrón que `facturas/usecases/cache.ts`).
- **Leaflet (F1)**: nueva dependencia frontend (`leaflet` + `vue-leaflet` o uso directo).
  Sin API key. ~40KB gzipped.
- **Passkit (F3)**: nueva dependencia para Apple Wallet pass generation
  (`passkit-generator` o similar). Requiere certificado Apple Developer del hotel.
- **GBP API / TripAdvisor Content API / StayAPI (F3)**: 3 integraciones externas con
  auth por API key por hotel. Crédenciales en `configuration(key='external_reviews_*')`.

## Success Criteria

- [ ] F0: `GET /api/public/hotels/:slug` devuelve name, descriptionJson multilingüe,
      accommodationType, starRating, address, lat/lng, phone/email/website,
      checkIn/checkOut, políticas, tax, logo, amenities — y NUNCA creds/taxId/internalNotes.
- [ ] F0: `hotel_media` permite subir/ordenar galería + hero + fotos por habitación.
- [ ] F0: `GET /api/public/hotels/:slug/reviews` devuelve reseñas + aggregate score +
      distribución + paginación, respetando `publishReviewScore`/`publishComments`.
- [ ] F0: 1 sola fuente de verdad de reserva (`Reservations`); endpoint plural
      deprecado behind flag, no dropeado.
- [ ] F0: el botón "Confirmar y Pagar" del widget invoca Stripe Checkout Session y el
      webhook confirma la reserva sin doble-cobro.
- [ ] F0: `GET /api/public/bookings/:id` requiere access token devuelto al crear (cierre
      IDOR).
- [ ] F1: `/h/:slug` sirve landing configurable por bloques con toggle + orden.
- [ ] F1: JSON-LD (Hotel/LodgingBusiness + AggregateRating + FAQPage + Offer) presente
      en el HTML de `/h/:slug`.
- [ ] F1: mapa Leaflet renderiza con lat/lng del hotel.
- [ ] F2: widget SPA-first sub-2s en mobile 4G (Lighthouse audit).
- [ ] F2: multi-step completo (search → rooms → upsells → guest checkout → pay →
      confirm) sin forzar cuenta de usuario.
- [ ] F2: tarifa "From $X" + member rate + impuestos desglosados + políticas visibles.
- [ ] F2: promo code funcional (valida + aplica % o monto fijo + respeta maxUses).
- [ ] F2: urgencia con dato vivo del PMS ("3 habitaciones left at this rate").
- [ ] F2: i18n ES/EN/PT con fallback, multi-moneda con geo-IP.
- [ ] F3: agregador GBP + TripAdvisor + StayAPI corre nightly, cachea 24h, degrada
      graceful si una API cae.
- [ ] F3: badges multi-canal + score agregado DENTRO del widget.
- [ ] F3: wallet pass Apple+Google se genera al confirmar, incluye código TTLock.
- [ ] F3: Meta CAPI + GA4-SS + Enhanced Conversions disparan server-side al confirmar.
- [ ] F3: abandon recovery email se manda 1–4h post-abandono.
- [ ] F4: funnel de analytics real (view → search → select → form → pay → confirm)
      reemplaza `topRoomTypes:[]`.
- [ ] F4: availability_cache o bien borrada o bien implementada (decisión tomada en design).
- [ ] F4: `publishReviewScore`/`publishComments` o bien implementados o bien eliminados
      del modelo.
- [ ] `bun run typecheck` (backend) + `cd frontend && bun run typecheck` (vue-tsc -b) +
      `arckode analyze` (0 violaciones) en cada fase.
