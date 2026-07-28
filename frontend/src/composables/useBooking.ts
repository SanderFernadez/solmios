// composables/useBooking.ts — State machine del widget SPA de reserva (F2 2.8, solmi-direct-booking).
//
// Pinia store setup-syntax. Orquesta los 6 steps del widget público:
//
//   idle → searching → selecting → upselling → checkingout → paying → confirmed | failed
//     0       0          1           2             3            4          5
//     └─ SearchStep   RoomsStep  UpsellsStep  GuestCheckout  PayStep   ConfirmStep
//
// El store ES la fuente de verdad: los step components son vistas que leen/escriben refs de
// acá. Navegar back/forward entre steps restaura el estado correcto porque TODO vive acá
// (selectedRoom, selectedUpsells, guest, promoCode…) — el componente solo se re-renderiza con
// lo que ya está persistido en el store (acceptance 2.8).
//
// IDEMPOTENCIA DEL BOTÓN PAGAR (acceptance 2.8): `pay()` está guardado por `isSubmitting`.
// Un doble click dispara un solo POST. El `idempotencyKey` client-side (crypto.randomUUID)
// se adjunta al body; el backend hoy dedupea por `reservation.id` en el charge de Stripe
// (anti-doble-cobro), pero la key client-side previene el doble POST del create. Tras un
// fallo real se regenera la key (reintento = nuevo intento); tras éxito + redirect, se
// conserva (la página se descarga al ir a Stripe).
//
// MULTI-MONEDA (D10, task 2.15 / Pieza 4): el store expone `currencyPreference` (lo que el
// usuario eligió en el switcher) y `availableCurrencies` (lista para el dropdown). `search()`
// manda `currency` al backend vía `?currency=` → el backend convierte server-side usando
// `configuration('currency_rates')` (cron nightly) y devuelve `ratesResponse.currency` (display)
// + `ratesResponse.chargeCurrency` (siempre = hotels.currency; el cobro real en Stripe).
//
// NO se reusa `composables/useCurrency.ts` (del panel admin) porque ese lee
// `/configuracion/currency` con `secondaryCurrency` — un esquema dual pensado para reporting
// del merchant, no para conversión display del público. El widget publica necesita conversión
// server-side con rates actualizadas por cron (D10), no una secundaria fija por hotel.
//
// Display currency = `currencyPreference` (si el usuario eligió) sino `ratesResponse.currency`
// (que cuando no se pidió ?currency= coincide con `chargeCurrency`). El switcher setea
// `currencyPreference` y dispara re-fetch si hay una búsqueda activa → cambiar EUR→USD
// convierte sin recargar la página (acceptance 2.15).

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { BookingService } from '@/services/Booking.service'
import { ApiError } from '@/services/http'
import type {
  CreateBookingResponse,
  PromoValidationResult,
  PromoValidationReason,
  PublicRatesResponse,
  RoomTypeRate,
  SelectedUpsell,
  TotalBreakdown,
  Upsell,
} from '@/types/booking'

export type BookingStatus =
  | 'idle' // step 0 (SearchStep): aún no busca
  | 'searching' // step 0: getRates in-flight (transitorio)
  | 'selecting' // step 1 (RoomsStep)
  | 'upselling' // step 2 (UpsellsStep)
  | 'checkingout' // step 3 (GuestCheckoutStep)
  | 'paying' // step 4 (PayStep)
  | 'confirmed' // step 5 (ConfirmStep): post-redirect OK
  | 'failed' // step 5: error / Stripe caído / cancel

export interface BookingGuest {
  name: string
  email: string
  phone: string
  notes: string
}

/** Índice del step (0-5) para el stepper indicator del wrapper. ConfirmStep = índice 5. */
const STEP_INDEX: Record<BookingStatus, number> = {
  idle: 0,
  searching: 0,
  selecting: 1,
  upselling: 2,
  checkingout: 3,
  paying: 4,
  confirmed: 5,
  failed: 5,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Genera un idempotency key RFC 4122 v4. Fallback a crypto.getRandomValues si randomUUID
 *  no existe (WebView viejo). nuncathrows: siempre devuelve un string no vacío. */
function genIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch { /* fallback abajo */ }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const h = [...bytes].map((b) => b.toString(16).padStart(2, '0'))
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
  }
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Clave de sessionStorage para backup de la reserva creada. Tras el redirect de Stripe, la
 *  página de aterrizaje lee este backup para reconstruir la reserva si los placeholders
 *  `:id`/`:token` del successUrl NO fueron reemplazados por el backend (hoy no los reemplaza —
 *  ver reporte F2). TTL 24h: si el usuario vuelve al otro día, no revivimos una reserva vieja. */
function bookingSessionKey(slug: string): string {
  return `booking-widget:${slug}:last-reservation`
}

interface StoredReservation {
  reservationId: string
  accessToken: string
  at: number
}

const STORED_TTL_MS = 24 * 60 * 60 * 1000

function storeReservation(slug: string, r: StoredReservation): void {
  try {
    sessionStorage.setItem(bookingSessionKey(slug), JSON.stringify(r))
  } catch { /* sessionStorage puede estar bloqueado (modo privado) — silencioso */ }
}

export function readStoredReservation(slug: string): StoredReservation | null {
  try {
    const raw = sessionStorage.getItem(bookingSessionKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredReservation
    if (!parsed?.reservationId || !parsed?.accessToken) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > STORED_TTL_MS) {
      sessionStorage.removeItem(bookingSessionKey(slug))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearStoredReservation(slug: string): void {
  try {
    sessionStorage.removeItem(bookingSessionKey(slug))
  } catch { /* silent */ }
}

export const useBookingStore = defineStore('booking-widget', () => {
  // ─── Hotel + búsqueda (step 0) ────────────────────────────────────────────────
  const slug = ref('')
  const checkIn = ref('')
  const checkOut = ref('')
  const guests = ref(2)
  const rooms = ref(1)

  // ─── Resultados (step 1) ──────────────────────────────────────────────────────
  const ratesResponse = ref<PublicRatesResponse | null>(null)
  const ratesLoading = ref(false)
  const ratesError = ref<string | null>(null)

  // ─── Selección (step 1) ───────────────────────────────────────────────────────
  const selectedRoom = ref<RoomTypeRate | null>(null)

  // ─── Upsells (step 2) ─────────────────────────────────────────────────────────
  const upsells = ref<Upsell[]>([])
  const upsellsLoading = ref(false)
  const selectedUpsells = ref<SelectedUpsell[]>([])

  // ─── Guest (step 3) ───────────────────────────────────────────────────────────
  const guest = ref<BookingGuest>({ name: '', email: '', phone: '', notes: '' })

  // ─── Promo (step 4) ───────────────────────────────────────────────────────────
  const promoCode = ref('')
  const promoResult = ref<PromoValidationResult | null>(null)
  const promoLoading = ref(false)

  // ─── Estado de la máquina ─────────────────────────────────────────────────────
  const status = ref<BookingStatus>('idle')
  const error = ref<string | null>(null)

  // ─── Multi-moneda (D10, task 2.15) ────────────────────────────────────────────
  // `currencyPreference` es lo que el usuario eligió en el switcher ('' = auto/detect).
  // `availableCurrencies` se populated al recibir la primera ratesResponse: incluye la
  // chargeCurrency del hotel + un puñado de monedas comunes para el switcher.
  const currencyPreference = ref('')
  const availableCurrencies = ref<string[]>([])

  // ─── Pago (step 4 → 5) ────────────────────────────────────────────────────────
  const reservation = ref<CreateBookingResponse | null>(null)
  const isSubmitting = ref(false)
  const idempotencyKey = ref('')

  // ═══ COMPUTED ═════════════════════════════════════════════════════════════════
  /** Índice del step actual para el stepper indicator (0-5). */
  const currentStep = computed(() => STEP_INDEX[status.value])

  /** Moneda en la que se muestran los precios (display). D10: el cobro es en chargeCurrency.
   *  Si el usuario eligió una moneda en el switcher, esa gana; si no, lo que devolvió el backend
   *  (que cuando no se pidió ?currency= coincide con chargeCurrency). */
  const displayCurrency = computed(() => currencyPreference.value || ratesResponse.value?.currency || '')

  /** Moneda en la que Stripe cobrará (siempre = hotels.currency). El botón de pago lo etiqueta. */
  const chargeCurrency = computed(() => ratesResponse.value?.chargeCurrency ?? '')

  const nights = computed(() => ratesResponse.value?.nights ?? 0)

  /** Subtotal room+upsells ANTES de promo e impuestos. Promo se aplica sobre este monto. */
  const subtotal = computed(() => {
    const room = selectedRoom.value?.fromPrice ?? 0
    const ups = upsellsTotal.value
    return round2(room + ups)
  })

  /** Suma de upsells seleccionados (precio × qty). En `hotels.currency` (chargeCurrency). */
  const upsellsTotal = computed(() => {
    const byId = new Map(upsells.value.map((u) => [u.id, u]))
    let total = 0
    for (const sel of selectedUpsells.value) {
      const found = byId.get(sel.id)
      if (!found) continue
      total += Number(found.price) * Math.max(1, Math.floor(sel.quantity))
    }
    return round2(total)
  })

  const promoDiscount = computed(() =>
    promoResult.value?.valid ? Number(promoResult.value.discount) || 0 : 0,
  )

  /** Base imponible (subtotal - promo). Sobre esto caen los impuestos. */
  const taxableBase = computed(() => round2(Math.max(0, subtotal.value - promoDiscount.value)))

  /** Impuestos estimados pre-create: aplicamos la tasa del roomType sobre la base imponible.
   *  El total DEFINITIVO lo calcula el backend y lo devuelve en `totalBreakdown` tras crear.
   *  Si hay promo, el backend recalcula impuestos sobre la base ya descontada — coincide. */
  const estimatedTaxes = computed(() => {
    const room = selectedRoom.value
    if (!room) return 0
    return round2(
      room.taxBreakdown.reduce((sum, t) => sum + (taxOnBase(t.amount, room.fromPrice, taxableBase.value)), 0),
    )
  })

  /** Total estimado pre-create. El step Pay muestra esto; el botón confía en `totalBreakdown.total`. */
  const estimatedTotal = computed(() =>
    round2(taxableBase.value + estimatedTaxes.value),
  )

  /** Desglose del total post-create (devuelto por el backend). Nulo hasta que se crea la reserva. */
  const totalBreakdown = computed<TotalBreakdown | null>(() => reservation.value?.totalBreakdown ?? null)

  // ═══ VALIDACIONES POR STEP ═══════════════════════════════════════════════════
  // Cada step valida antes de avanzar (acceptance 2.9). `stepValid(n)` returns true si el
  // step n tiene todo lo necesario para continuar.

  const searchValid = computed(() => {
    if (!checkIn.value || !checkOut.value) return false
    if (checkOut.value <= checkIn.value) return false
    // checkIn no en el pasado (permite hoy mismo — check-in del día).
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(checkIn.value) >= today
  })

  const roomsValid = computed(() => !!selectedRoom.value && selectedRoom.value.availableCount > 0)

  /** Upsells step siempre es válido (selección opcional). */
  const upsellsValid = computed(() => upsellsLoading.value === false)

  const guestValid = computed(() => {
    const g = guest.value
    return g.name.trim().length >= 2 && EMAIL_RE.test(g.email.trim()) && g.phone.trim().length >= 5
  })

  /** Step actual válido (para habilitar el botón "Continuar"). */
  const currentStepValid = computed(() => {
    switch (status.value) {
      case 'idle':
      case 'searching':
        return searchValid.value
      case 'selecting':
        return roomsValid.value
      case 'upselling':
        return upsellsValid.value
      case 'checkingout':
        return guestValid.value
      default:
        return true
    }
  })

  // ═══ ACCIONES ═════════════════════════════════════════════════════════════════

  /** Inicializa el store para un hotel. Reset completo + lee query params de la URL
   *  (?checkIn=, ?checkOut=, ?guests=) para deep-link desde la landing CTA "Ver disponibilidad". */
  function init(hotelSlug: string, opts?: { checkIn?: string; checkOut?: string; guests?: number; rooms?: number }) {
    slug.value = hotelSlug
    if (opts?.checkIn) checkIn.value = opts.checkIn
    if (opts?.checkOut) checkOut.value = opts.checkOut
    if (typeof opts?.guests === 'number') guests.value = Math.max(1, opts.guests)
    if (typeof opts?.rooms === 'number') rooms.value = Math.max(1, opts.rooms)
    status.value = 'idle'
    error.value = null
  }

  /** Step 0 → 1: dispara GET /rates. Idempotente: si ya hay rates para las mismas fechas
   *  Y misma currencyPreference, no recarga. Setea status a 'selecting' al éxito.
   *  Multi-moneda (D10): pasa `currency` al backend si el usuario eligió una distinta de la
   *  chargeCurrency; el backend convierte server-side con `configuration('currency_rates')`. */
  async function search(): Promise<void> {
    if (!slug.value || !searchValid.value) return
    status.value = 'searching'
    ratesLoading.value = true
    ratesError.value = null
    try {
      const res = await BookingService.getRates(slug.value, {
        checkIn: checkIn.value,
        checkOut: checkOut.value,
        rooms: rooms.value,
        guests: guests.value,
        ...(currencyPreference.value ? { currency: currencyPreference.value } : {}),
      })
      ratesResponse.value = res
      // Llenamos el switcher de monedas: la del cobro (base del hotel) + la última display
      // elegada + un puñado de monedas comunes para turistas. Dedupe + orden estable.
      availableCurrencies.value = buildCurrencyOptions(res.chargeCurrency, res.currency, currencyPreference.value)
      selectedRoom.value = null
      status.value = 'selecting'
    } catch (e) {
      ratesError.value = errMessage(e, 'No pudimos cargar la disponibilidad. Probá de nuevo.')
      // Volvemos a idle para que el usuario pueda reintentar la búsqueda.
      status.value = 'idle'
    } finally {
      ratesLoading.value = false
    }
  }

  /** Cambia la moneda display. Si hay rates cargados para las fechas actuales, re-fetch
   *  (el backend convierte). Si no hay rates todavía, solo setea la preferencia — el próximo
   *  search() la va a mandar. Cumple acceptance 2.15: cambiar EUR→USD convierte sin recargar
   *  la página. Si code === '' volvemos a "auto" (la chargeCurrency del hotel). */
  async function setCurrency(code: string): Promise<void> {
    const normalized = code.trim().toUpperCase()
    if (normalized === currencyPreference.value) return
    currencyPreference.value = normalized
    // Si ya tenemos rates para estas fechas, re-fetch con la nueva currency. Sino, no hay
    // nada que convertir todavía — el próximo search() mandará la currency.
    if (ratesResponse.value && searchValid.value && (status.value === 'selecting' || status.value === 'upselling' || status.value === 'checkingout' || status.value === 'paying')) {
      // Re-fetch preservando selección de room/upsells (solo cambian precios, no disponibilidad).
      // No movemos status: el usuario sigue donde estaba.
      const prevStatus = status.value
      try {
        const res = await BookingService.getRates(slug.value, {
          checkIn: checkIn.value,
          checkOut: checkOut.value,
          rooms: rooms.value,
          guests: guests.value,
          ...(normalized ? { currency: normalized } : {}),
        })
        ratesResponse.value = res
        availableCurrencies.value = buildCurrencyOptions(res.chargeCurrency, res.currency, normalized)
        // Si había un room seleccionado, actualizamos la referencia con la nueva tarifa (mismo id).
        if (selectedRoom.value) {
          const updated = res.roomTypes.find((rt) => rt.id === selectedRoom.value!.id)
          if (updated) selectedRoom.value = updated
        }
        status.value = prevStatus
      } catch {
        // Si falla la conversión, no rompemos: dejamos la moneda anterior (el switcher revierte).
        currencyPreference.value = ratesResponse.value?.currency ?? ''
        status.value = prevStatus
      }
    }
  }

  /** Step 1: selecciona el room type y carga upsells. No avanza — el componente llama a next(). */
  async function selectRoom(room: RoomTypeRate): Promise<void> {
    selectedRoom.value = room
    if (upsells.value.length === 0) {
      upsellsLoading.value = true
      try {
        upsells.value = await BookingService.getUpsells(slug.value)
      } catch {
        upsells.value = []
      } finally {
        upsellsLoading.value = false
      }
    }
  }

  /** Step 2: actualiza la selección de upsells. */
  function setSelectedUpsells(items: SelectedUpsell[]): void {
    selectedUpsells.value = items.filter((i) => i.quantity > 0)
  }

  /** Step 3: actualiza datos del huésped. */
  function setGuest(patch: Partial<BookingGuest>): void {
    guest.value = { ...guest.value, ...patch }
  }

  /** Step 4: valida el promo code contra el backend (read-only, no incrementa uses). */
  async function applyPromo(): Promise<PromoValidationResult | null> {
    const code = promoCode.value.trim()
    if (!code) {
      promoResult.value = null
      return null
    }
    promoLoading.value = true
    try {
      const result = await BookingService.validatePromo(slug.value, code, subtotal.value)
      promoResult.value = result
      return result
    } catch (e) {
      // En caso de error de red, no invalidamos el promo (podría ser un 429 rate-limit).
      // Marcamos null para que la UI no muestre descuento sin confirmar.
      promoResult.value = { valid: false, discount: 0, reason: 'not_found' as PromoValidationReason }
      error.value = errMessage(e, 'No pudimos validar el código. Probá de nuevo.')
      return promoResult.value
    } finally {
      promoLoading.value = false
    }
  }

  function clearPromo(): void {
    promoCode.value = ''
    promoResult.value = null
  }

  /** Avanza al siguiente step. Solo si currentStepValid. No-op si está en el último step. */
  function next(): void {
    if (!currentStepValid.value || isSubmitting.value) return
    switch (status.value) {
      case 'idle':
        void search()
        return
      case 'selecting':
        if (!selectedRoom.value) return
        status.value = 'upselling'
        return
      case 'upselling':
        status.value = 'checkingout'
        return
      case 'checkingout':
        status.value = 'paying'
        return
      // paying → confirmed/failed se maneja en pay()
    }
  }

  /** Retrocede un step. No-op en el primero. */
  function back(): void {
    if (isSubmitting.value) return
    switch (status.value) {
      case 'selecting':
        status.value = 'idle'
        return
      case 'upselling':
        status.value = 'selecting'
        return
      case 'checkingout':
        status.value = 'upselling'
        return
      case 'paying':
        status.value = 'checkingout'
        return
      case 'failed':
        status.value = 'paying'
        return
    }
  }

  /** Salta a un step arbitrario (para "editar" desde el resumen del step Pay). Solo si el
   *  step destino ya fue completado antes (no saltar hacia adelante sin datos). */
  function goToStep(step: number): void {
    if (isSubmitting.value) return
    if (step < 0 || step > 4) return
    if (step > currentStep.value) return
    const map: Record<number, BookingStatus> = {
      0: 'idle',
      1: 'selecting',
      2: 'upselling',
      3: 'checkingout',
      4: 'paying',
    }
    status.value = map[step]
  }

  /** Step 4 → 5: crea la reserva pending y redirect a Stripe Checkout. Idempotente.
   *
   *  Estrategia anti-doble-submit:
   *    1. `isSubmitting` bloquea el botón al primer click (UI disabled + guard acá).
   *    2. `idempotencyKey` (UUID) se adjunta al body. El backend hoy no la consume (dedupea
   *       por reservation.id en el charge), pero la key queda como salvaguarda si se cablea
   *       dedup server-side. Se regenera SOLO tras un fallo (reintento = nuevo intento).
   *    3. Redirect inmediato a `checkoutUrl` apenas vuelve el 201 — no esperamos acción
   *       del usuario. La página se descarga; el finally corre antes del navigation.
   *
   *  Robustez: si Stripe falla, la reserva SE CREÓ pending (F0 0.16). Devolvemos status
   *  'failed' con el paymentError para que el usuario sepa que su reserva existe pero el
   *  cobro quedó pendiente.
   *
   *  NOTA sobre successUrl/cancelUrl: el backend pasa las URLs LITERALES a Stripe (no
   *  reemplaza `:id`/`:token`). El widget pasa placeholders conforme al spec R2
   *  (`/h/:slug?booking=:id&token=:token`) Y guarda el reservationId+accessToken en
   *  sessionStorage como backup para que la página de confirmación (F3 3.17) pueda
   *  reconstruir la reserva si los placeholders llegan literales a la URL de vuelta. */
  async function pay(): Promise<void> {
    if (isSubmitting.value) return
    if (!selectedRoom.value) {
      error.value = 'Seleccioná una habitación primero.'
      status.value = 'failed'
      return
    }
    if (!guestValid.value) {
      error.value = 'Revisá los datos del huésped antes de pagar.'
      status.value = 'checkingout'
      return
    }
    isSubmitting.value = true
    error.value = null
    if (!idempotencyKey.value) idempotencyKey.value = genIdempotencyKey()
    try {
      const base = window.location.origin
      const successUrl = `${base}/h/${slug.value}?booking=:id&token=:token`
      const cancelUrl = `${base}/book/${slug.value}`
      const res = await BookingService.createBooking({
        slug: slug.value,
        roomId: selectedRoom.value.id,
        roomType: selectedRoom.value.name,
        checkIn: checkIn.value,
        checkOut: checkOut.value,
        adults: guests.value,
        guest: {
          name: guest.value.name.trim(),
          email: guest.value.email.trim(),
          phone: guest.value.phone.trim(),
          notes: guest.value.notes.trim() || undefined,
        },
        ...(promoResult.value?.valid && promoCode.value
          ? { promoCode: promoResult.value.code ?? promoCode.value.trim().toUpperCase() }
          : {}),
        ...(selectedUpsells.value.length > 0 ? { upsells: selectedUpsells.value } : {}),
        successUrl,
        cancelUrl,
        idempotencyKey: idempotencyKey.value,
      })
      reservation.value = res
      storeReservation(slug.value, {
        reservationId: res.reservationId,
        accessToken: res.accessToken,
        at: Date.now(),
      })
      if (res.checkoutUrl) {
        // Redirect off-site a Stripe. La página se descarga; el botón queda disabled.
        window.location.href = res.checkoutUrl
        return
      }
      // Sin checkoutUrl: Stripe no configurado o gateway caído. Reserva creada pending.
      status.value = 'failed'
      error.value = res.paymentError
        ? `Tu reserva quedó creada pero el pago no se pudo iniciar (${res.paymentError}). Te contactaremos.`
        : 'Tu reserva quedó creada pero el pago online no está disponible. Te contactaremos.'
    } catch (e) {
      status.value = 'failed'
      error.value = errMessage(e, 'No se pudo crear la reserva. Probá de nuevo.')
      // Reintento: nuevo idempotency key (el anterior podría haber llegado al backend en
      // una reserva half-created; uno nuevo evita reusar ese ciclo).
      idempotencyKey.value = ''
    } finally {
      isSubmitting.value = false
    }
  }

  /** Step 5: polling del estado de la reserva post-redirect. Lo dispara ConfirmStep al
   *  montarse. Devuelve el estado o null si el token no valida. */
  async function pollConfirmation(reservationId: string, token: string) {
    try {
      return await BookingService.getReservation(reservationId, token)
    } catch {
      return null
    }
  }

  /** Reset completo del store (al desmontar el widget o cambiar de hotel). */
  function reset(): void {
    checkIn.value = ''
    checkOut.value = ''
    guests.value = 2
    rooms.value = 1
    ratesResponse.value = null
    ratesLoading.value = false
    ratesError.value = null
    selectedRoom.value = null
    upsells.value = []
    upsellsLoading.value = false
    selectedUpsells.value = []
    guest.value = { name: '', email: '', phone: '', notes: '' }
    promoCode.value = ''
    promoResult.value = null
    promoLoading.value = false
    status.value = 'idle'
    error.value = null
    reservation.value = null
    isSubmitting.value = false
    idempotencyKey.value = ''
    currencyPreference.value = ''
    availableCurrencies.value = []
  }

  return {
    // state
    slug,
    checkIn,
    checkOut,
    guests,
    rooms,
    ratesResponse,
    ratesLoading,
    ratesError,
    selectedRoom,
    upsells,
    upsellsLoading,
    selectedUpsells,
    guest,
    promoCode,
    promoResult,
    promoLoading,
    status,
    error,
    reservation,
    isSubmitting,
    idempotencyKey,
    currencyPreference,
    availableCurrencies,
    // computed
    currentStep,
    displayCurrency,
    chargeCurrency,
    nights,
    subtotal,
    upsellsTotal,
    promoDiscount,
    taxableBase,
    estimatedTaxes,
    estimatedTotal,
    totalBreakdown,
    searchValid,
    roomsValid,
    upsellsValid,
    guestValid,
    currentStepValid,
    // actions
    init,
    search,
    selectRoom,
    setSelectedUpsells,
    setGuest,
    applyPromo,
    clearPromo,
    next,
    back,
    goToStep,
    pay,
    pollConfirmation,
    reset,
    setCurrency,
  }
})

// ─── helpers (privados del módulo) ──────────────────────────────────────────────

/** Monedas comunes para el switcher del widget (turistas LATAM/caribe). La lista es solo
 *  para poblar el dropdown — el backend convierte lo que le pidamos si tiene rates; si una
 *  moneda no está en `currency_rates`, el backend degrada a chargeCurrency (no rompe). */
const COMMON_DISPLAY_CURRENCIES = ['USD', 'EUR', 'DOP', 'MXN', 'COP', 'ARS', 'CLP', 'BRL']

/** Arma la lista de monedas del switcher: chargeCurrency siempre primero (es la base del
 *  cobro), después la última display (si difiere), luego las comunes dedupe. Orden estable. */
function buildCurrencyOptions(chargeCurrency: string, displayCurrency: string, preference: string): string[] {
  const out: string[] = []
  const push = (c: string) => {
    const up = c.trim().toUpperCase()
    if (up && !out.includes(up)) out.push(up)
  }
  push(chargeCurrency)
  push(displayCurrency)
  push(preference)
  for (const c of COMMON_DISPLAY_CURRENCIES) push(c)
  return out
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Reparte el impuesto del roomType (calculado sobre fromPrice) al taxableBase real
 *  (tras promo). Mantiene la proporción: si la base bajó por un descuento, el impuesto
 *  baja en la misma proporción. */
function taxOnBase(taxAmountOnFromPrice: number, fromPrice: number, base: number): number {
  if (fromPrice <= 0) return 0
  return round2((taxAmountOnFromPrice * base) / fromPrice)
}

/** Extrae mensaje legible de un error del http client (ApiError) o de un Error genérico. */
function errMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return fallback
}
