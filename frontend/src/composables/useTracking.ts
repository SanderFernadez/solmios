// composables/useTracking.ts — Complemento client-side del server-tracking (F3 3.18,
// solmi-direct-booking / spec server-tracking).
//
// El backend (F3 3.11) dispara Meta CAPI + GA4 Measurement Protocol Server-Side con
// `event_id = reservationId` desde el webhook Stripe. Meta y GA4 DEDUPLICAN eventos con el
// mismo event_id/client_id (spec server-tracking "Deduplication event_id" y "Pixel client-side
// + CAPI server-side"). Este composable es el COMPLEMENTO client-side: dispara los mismos
// eventos desde el navegador para que Meta Events Manager / GA4 Realtime cuenten 1 conversión
// (no 2) y para que pixel helpers como Meta Pixel Helper detecten el fire.
//
// Cuándo disparar (integración con el widget F2):
//   - view   → al montar la landing/widget (GA4 page_view ya lo hace gtag automáticamente).
//   - search → tras成功 search() en useBooking (Step 0).
//   - select → tras selectRoom() (Step 1).
//   - upsell → tras añadir upsell (Step 2).
//   - form   → al submit form de guest (Step 3).
//   - pay    → tras createBooking éxito (Step 4, antes del redirect a Stripe).
//   - purchase → tras confirmación (event_id = reservationId, dedup con CAPI server-side).
//
// DEDUP (spec server-tracking "Deduplication event_id"):
//   Meta deduplica pixel + CAPI cuando AMBOS usan el mismo `event_id` ( ReservationId).
//   GA4 deduplica eventos del Measurement Protocol + gtag.js con el mismo `client_id` y
//   `transaction_id`. Por eso este composable genera y persiste un `client_id` estable.
//
// SEGURIDAD: este composable NO accede a `meta_capi_token`, `ga4_api_secret` ni hashes PII.
// Esos son server-side únicamente. Acá solo usamos IDs PÚBLICOS (Pixel ID, Measurement ID)
// que van en el HTML de todas formas. Enhanced Conversions (PII hashing) es 100% server-side.
//
// OPT-IN (spec "Opt-in explícito del huésped"): el caller pasa `optIn` en cada track().
// Si optIn=false NO se dispara nada client-side — el evento Server-Side de todas formas va
// sin `user_data` (regla del backend). Coherente con la regla del spec.
//
// INIT: el composable se inicializa UNA vez con los IDs del hotel. Hoy no hay endpoint público
// que los devuelva (`configuration(meta_pixel_id)` solo lo ve admin). Cuando exista, el caller
// lo consume y pasa los IDs al init. Mientras tanto, los callers pueden pasar IDs por env vars
// (VITE_META_PIXEL_ID, VITE_GA4_MEASUREMENT_ID) como fallback global para property unica.
//
// F4 4.1 (D13) — SERVER-SIDE PERSISTENCE: además de disparar gtag/fbq, track() POSTea el evento
// a `/api/public/events` para que el backend lo persista en `tracking_events` con
// `target='internal'`. Esto alimenta el funnel de conversión del panel admin (que antes era
// todo ceros porque ningún step se persistía). Fire-and-forget: si el POST falla, NO rompe la
// UX del huésped (el funnel es best-effort, lo importante es el pixel fire).

import { ref } from 'vue'
import { http } from '@/services/http'

export type TrackingEventName =
  | 'view'
  | 'search'
  | 'select'
  | 'upsell'
  | 'form'
  | 'pay'
  | 'purchase'
  | 'abandon'

export interface TrackParams {
  /** event_id estable para dedup con CAPI server-side. Obligatorio para 'purchase'. */
  eventId?: string
  /** Valor monetario de la conversión (para 'pay' / 'purchase'). */
  value?: number
  /** Moneda ISO 4217 del valor. */
  currency?: string
  /** ID de la reserva (reservation.id). Es el dedup key para Meta/GA4. */
  reservationId?: string
  /** ID del room type (para 'select'/'pay'). */
  roomId?: string
  /** Consentimiento explícito del huésped. Sin él, no disparamos Enhanced data. */
  optIn?: boolean
  /** F4 4.1 — Hotel (id o slug) para persistir el evento server-side (funnel analytics). */
  hotelId?: string
  /** Cualquier otra prop libre (lang, nación, etc.). */
  [k: string]: unknown
}

export interface TrackingConfig {
  metaPixelId: string | null
  ga4MeasurementId: string | null
  /** Para tests/SSR: si false, NO toca window/document. Default true. */
  enabled?: boolean
}

interface GaqWindow { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }
interface FbqWindow { fbq?: (...args: unknown[]) => void; _fbq?: unknown }

const CLIENT_ID_KEY = 'solmi:tracking:client_id'
const CLIENT_ID_VERSION = '1'

/**
 * Genera o recupera el client_id estable desde localStorage. GA4 usa `_ga` cookie
 * (GA1.1.X.YYYY) como client_id; Meta usa `_fbp` (fb.1.X.Y). Cuando ambos no están,
 * generamos un UUID propio y lo persistimos para que el Server-Side y client-side usen
 * el MISMO id (dedup funciona solo si coincide).
 */
export function getStableClientId(): string {
  if (typeof window === 'undefined') return ''
  try {
    // Intento 1: leer _ga cookie (formato GA1.1.<clientId>.<timestamp>).
    const match = /_ga=GA1\.\d\.(?<cid>[^;]+)/.exec(document.cookie)
    if (match?.groups?.cid) return match.groups.cid
    // Intento 2: leer nuestro localStorage.
    const stored = window.localStorage.getItem(CLIENT_ID_KEY)
    if (stored && stored.startsWith(CLIENT_ID_VERSION + ':')) {
      return stored.slice(CLIENT_ID_VERSION.length + 1)
    }
    // Generar nuevo y persistir. Formato UUID v4 si crypto está, fallback a timestamp+random.
    const fresh = genClientId()
    window.localStorage.setItem(CLIENT_ID_KEY, `${CLIENT_ID_VERSION}:${fresh}`)
    return fresh
  } catch {
    return ''
  }
}

function genClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch { /* noop */ }
  return `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`
}

// Instancia singleton del composable (un solo pixel por página).
const config = ref<TrackingConfig>({ metaPixelId: null, ga4MeasurementId: null, enabled: true })
const scriptsLoaded = ref(false)

/**
 * Inicializa el tracking con los IDs del hotel. Idempotente: solo carga scripts una vez.
 * Sin IDs (null/empty), las llamadas `track()` son no-op silenciosas.
 *
 * Para activar client-side tracking hoy (sin endpoint público de IDs), pasar los IDs por
 * VITE_META_PIXEL_ID / VITE_GA4_MEASUREMENT_ID en el build. Cuando exista endpoint público,
 * el caller hace el fetch y pasa los IDs al init.
 */
export function initTracking(cfg: Partial<TrackingConfig>): void {
  config.value = {
    metaPixelId: cfg.metaPixelId ?? config.value.metaPixelId,
    ga4MeasurementId: cfg.ga4MeasurementId ?? config.value.ga4MeasurementId,
    enabled: cfg.enabled ?? config.value.enabled,
  }
  if (config.value.enabled === false) return
  if (scriptsLoaded.value) return
  scriptsLoaded.value = true
  injectScripts(config.value)
}

/**
 * Dispara el evento client-side con dedup. No lanza errores: si GA4/Meta no cargaron,
 * loguea a consola en dev y sigue. Siempre devuelve el event_id usado (para que el caller
 * pueda pasarlo al backend y que el Server-Side use el mismo).
 */
export function track(event: TrackingEventName, params: TrackParams = {}): string | null {
  if (config.value.enabled === false) return null

  // event_id: para 'purchase', usar reservationId (dedup CAPI). Para otros, generar uno nuevo
  // (no hay dedup server-side para view/search/…; el server tracking los persiste separados).
  const eventId =
    params.eventId
    ?? (event === 'purchase' ? params.reservationId : null)
    ?? genClientId()

  // GA4 client-side. gtag('event', name, params) — measurement_id va en el script loader.
  if (config.value.ga4MeasurementId) {
    fireGtag(event, eventId, params)
  }

  // Meta Pixel client-side. fbq('track', metaName, params, {eventID: eventId}).
  // Mapeo view/search/… a eventos estándar Meta (Purchase, Lead, ViewContent, …).
  if (config.value.metaPixelId && params.optIn !== false) {
    fireFbq(event, eventId, params)
  }

  // F4 4.1 (D13) — Persistir server-side para el funnel. fire-and-forget: el huésped no
  // espera este POST, y si falla (red, backend down), no hay que romper la UX. El
  // sessionId es el anonymousId del navegador (dedup client/server), y el hotelId lo
  // resuelve el backend desde el slug de la ruta pública si no se pasa.
  void persistFunnelEvent(event, params, eventId).catch(() => { /* best-effort */ })

  return eventId
}

/**
 * F4 4.1 — POST best-effort a /api/public/events para que el backend persista el evento
 * del funnel en tracking_events (target='internal'). Sin auth (ruta pública rate-limited).
 *
 * El endpoint sigue el schema `TrackEventSchema`: requiere hotelId + sessionId + event.
 * Si faltan, NO se postea (no tiene caso persistir un evento sin hotel).
 *
 * Mapeo: 'purchase' client-side → 'confirm' server-side (el step final del funnel). El
 * resto de events van con el mismo nombre (spec design.md D13).
 */
async function persistFunnelEvent(
  event: TrackingEventName,
  params: TrackParams,
  eventId: string,
): Promise<void> {
  if (typeof window === 'undefined') return
  const hotelId = resolveHotelId(params)
  if (!hotelId) return
  const funnelEvent = event === 'purchase' ? 'confirm' : event
  await http.post('/api/public/events', {
    hotelId,
    sessionId: eventId,
    event: funnelEvent,
    roomType: params.roomId,
    amount: typeof params.value === 'number' ? params.value : undefined,
  })
}

/**
 * Resuelve el hotelId para el evento server-side.Orden de preferencia:
 *  1. `params.hotelId` explícito (caller sabe el hotel).
 *  2. Atributo `data-hotel` del widget embebido (cuando está en sitio externo).
 *  3. Path param de la URL (`/h/:slug` o `/book/:slug`) — requiere resolver slug→id,
 *     pero el backend lo hace desde el slug si pasamos solo el slug. Hoy dejamos que
 *     el caller pase hotelId; si no, no persistimos (no queremos inventar IDs).
 */
function resolveHotelId(params: TrackParams): string | null {
  const explicit = params.hotelId
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit.trim()
  // Widget embebido: el loader setea `data-hotel="<slug>"` en el <script> que cargó el bundle.
  // `document.currentScript` es DEAD dentro de un bundle ES module (Vue/Vite): solo vive
  // mientras el <script> se está ejecutando line-by-line, y para el momento en que el composable
  // corre, `currentScript` ya es null. Buscamos el tag explícitamente por selector.
  try {
    if (typeof document === 'undefined') return null
    const tag = document.querySelector('script[data-hotel]') as HTMLScriptElement | null
    const slug = tag?.getAttribute('data-hotel')
    if (slug && slug.trim() !== '') return slug.trim()
  } catch { /* SSR o sin document */ }
  return null
}

// ─── Inyecta scripts GA4 + Meta Pixel (una sola vez por page load) ─────────────
function injectScripts(cfg: TrackingConfig): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // GA4 gtag.js
  if (cfg.ga4MeasurementId) {
    const w = window as unknown as GaqWindow
    w.dataLayer = w.dataLayer || []
    w.gtag = function (...args: unknown[]) {
      w.dataLayer!.push(args)
    }
    const cid = getStableClientId()
    w.gtag('js', new Date())
    w.gtag('config', cfg.ga4MeasurementId, {
      // Usar el client_id estable para que dedup con server-side funcione.
      client_id: cid || undefined,
      send_page_view: false, // lo disparamos manualmente en track('view')
    })
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4MeasurementId)}`
    document.head.appendChild(s)
  }

  // Meta Pixel
  if (cfg.metaPixelId) {
    /* eslint-disable */
    const w = window as unknown as FbqWindow & { _fbq?: unknown; fbq?: (...a: unknown[]) => void }
    if (!w.fbq) {
      const fbq = function (...args: unknown[]) {
        // @ts-expect-error call/queue signature of fbq is loose by design
        fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args)
      } as unknown as ((...a: unknown[]) => void) & { queue: unknown[]; callMethod?: unknown; loaded?: boolean }
      w.fbq = fbq
      fbq.queue = []
      fbq.loaded = true
      w._fbq = fbq
      const s = document.createElement('script')
      s.async = true
      s.src = 'https://connect.facebook.net/en_US/fbevents.js'
      const firstScript = document.getElementsByTagName('script')[0]
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(s, firstScript)
      } else {
        document.head.appendChild(s)
      }
    }
    w.fbq!('init', cfg.metaPixelId, { uid: getStableClientId() || undefined })
    /* eslint-enable */
  }
}

// ─── GA4 fire (gtag event) ────────────────────────────────────────────────────
function fireGtag(event: TrackingEventName, eventId: string, p: TrackParams): void {
  const w = window as unknown as GaqWindow
  if (typeof w.gtag !== 'function') return
  // Mapeo a eventos GA4 recomendados. transaction_id = eventId → dedup con server-side.
  const ga4Name = GA4_NAME_MAP[event] ?? event
  const payload: Record<string, unknown> = {
    event_id: eventId,
    send_to: config.value.ga4MeasurementId,
  }
  if (event === 'purchase' || event === 'pay') {
    payload.transaction_id = p.reservationId ?? eventId
    if (typeof p.value === 'number') payload.value = p.value
    if (p.currency) payload.currency = p.currency
    if (p.roomId) {
      payload.items = [{
        item_id: p.roomId,
        item_category: 'hotel',
        ...(typeof p.value === 'number' ? { price: p.value } : {}),
        quantity: 1,
      }]
    }
  }
  // view → page_view con location actual.
  if (event === 'view') {
    payload.page_location = typeof window !== 'undefined' ? window.location.href : ''
    payload.page_title = typeof document !== 'undefined' ? document.title : ''
  }
  w.gtag('event', ga4Name, payload)
}

// ─── Meta Pixel fire (fbq track) ──────────────────────────────────────────────
function fireFbq(event: TrackingEventName, eventId: string, p: TrackParams): void {
  const w = window as unknown as FbqWindow
  if (typeof w.fbq !== 'function') return
  // Mapeo a Standard Events Meta. 'purchase' → 'Purchase' con value/currency. 'search'/'select'
  // → 'ViewContent' (no hay 'Lead' semántico para PMS). 'form' → 'Lead'. 'view' → 'PageView'.
  const mapping: Record<TrackingEventName, { name: string | null; track: 'track' | 'trackCustom' }> = {
    view: { name: 'PageView', track: 'track' },
    search: { name: 'Search', track: 'track' },
    select: { name: 'ViewContent', track: 'track' },
    upsell: { name: 'AddToCart', track: 'track' },
    form: { name: 'Lead', track: 'track' },
    pay: { name: 'AddPaymentInfo', track: 'track' },
    purchase: { name: 'Purchase', track: 'track' },
    abandon: { name: null, track: 'trackCustom' },
  }
  const mapped = mapping[event]
  if (!mapped.name) return // 'abandon' → no client-side pixel (lo dispara solo el server)
  const payload: Record<string, unknown> = {
    content_type: 'hotel',
    content_ids: p.roomId ? [p.roomId] : [],
    currency: p.currency ?? 'USD',
  }
  if (typeof p.value === 'number') payload.value = p.value
  // eventID como 4to argumento → Meta dedup con CAPI server-side.
  w.fbq(mapped.track, mapped.name, payload, { eventID: eventId })
}

const GA4_NAME_MAP: Record<TrackingEventName, string> = {
  view: 'page_view',
  search: 'search',
  select: 'select_item',
  upsell: 'add_to_cart',
  form: 'generate_lead',
  pay: 'add_payment_info',
  purchase: 'purchase',
  abandon: 'abandon',
}

// ─── Composable ergonómico (opcional). Devuelve la API reactiva para usar en templates. ──
export function useTracking() {
  return {
    init: initTracking,
    track,
    clientId: getStableClientId(),
    config,
  }
}
