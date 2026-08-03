// bookingengine/usecases/public-rates.ts — GET /api/public/hotels/:slug/rates (F2 2.4).
//
// Devuelve room types disponibles con la tarifa derivada (precio lowest del type × noches)
// + impuestos desglosados (ITBIS desde configuration('taxes')) + availableCount por type
// (urgencia D11: el widget muestra "Pocas habitaciones a este precio" si availableCount<=3).
//
// Multi-moneda (D10): si ?currency=X difiere de hotels.currency, convierte usando
// `configuration(key='currency_rates', hotelId='platform')` poblado por el cron nightly
// (`shared/usecases/currency-rates-cron.ts`). Si no hay rates o falta la moneda origen/destino,
// degrada silenciosamente a hotels.currency (mejor mostrar precio correcto en la moneda base
// que inventear un 0 o un 1). El cobro SIEMPRE es en hotels.currency — esto es display only.
//
// Anti-enumeración: si el hotel no existe o no tiene onlineBookingStatus='active', MISMO 404
// (no revelar paused/inactive hotels desde la ruta pública — mismo criterio que public-hotel-info).
//
// Decisiones visibles (spec abierto, documentadas acá y en el reporte):
//  - `fromPrice` = precio por noche del type (el más bajo) × noches (TOTAL de la estadía, no
//    por noche). El spec scenario muestra "From $354 total ($100 × 3 + $54 ITBIS)" → total.
//  - `taxBreakdown` = Array<{ name, rate, amount }>. amount es el monto de ese impuesto sobre
//    fromPrice. Múltiples impuestos soportados (configuration('taxes') puede traer >1).
//  - `id` y `name` del room type usan ambos el slug del `roomType` (no hay entidad RoomType
//    propia en este PMS — `room.type` es un string libre: 'standard', 'double', etc.). El
//    frontend puede prettify/localizar.
import { NotFoundError } from 'arckode-framework'
import type { RepositoryAdapter } from 'arckode-framework'
import type { AvailabilityQuery, AvailabilityResult } from '../types'
import { resolvePolicy } from '../../../shared/usecases/cancellation-math'
import type { Tier } from '../../cancellation/types'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface PublicRatesDeps {
  hotels: RepositoryAdapter<any>
  /**
   * Use case de disponibilidad existente (cacheado). Lo pasamos como dep para testear sin orm.
   * Toma el mismo shape que `BookingengineService.checkAvailability` (la firma pública del svc).
   */
  availability: { checkAvailability(q: AvailabilityQuery): Promise<AvailabilityResult> }
  /** Repo de `Configuration` (KV por hotel). Lee `taxes` (por hotel) y `currency_rates` (global). */
  config: RepositoryAdapter<any>
  /**
   * FIX 2026-07-31 — Repo de `BookingConfig` (tabla `booking_config`, la que edita el admin en
   * `/panel/booking-engine`). Antes NINGÚN campo de esa pantalla (enabled/minNights/maxNights/
   * cancellationPolicy) se leía acá — el toggle "Activo/Inactivo" y los límites de estadía eran
   * pura decoración, guardaban en la DB pero no afectaban el motor público. Opcional: si no se
   * cablea, degrada a "todo permitido" (compat con callers/tests viejos).
   */
  bookingConfig?: RepositoryAdapter<any>
  /**
   * Repo de `Rooms` (tabla física de habitaciones) — para resolver `photoUrl` por type.
   * Mismo precedente que `BookingengineService` (roomsRepo directo, no connector: la
   * disponibilidad/fotos salen de las habitaciones reales, no hay entidad RoomType propia).
   * Opcional (compat callers/tests viejos, mismo criterio que `bookingConfig`): sin cablear,
   * `photoUrl` degrada a `null` en todos los room types.
   */
  rooms?: RepositoryAdapter<any>
  /** Repo de `HotelMedia` — fotos `type='room'` con `roomId` opcional hacia una room física.
   *  Opcional, mismo criterio que `rooms` de arriba. */
  hotelMedia?: RepositoryAdapter<any>
  /** F5 #627 — Repo de `CancellationPolicies` para resolver la política estructurada que se
   *  muestra al huésped en PayStep (tiers + ventana gratuita + penalidad). Opcional: sin
   *  cablear, `cancellationSummary` queda null y el widget cae al texto libre `cancellationPolicy`. */
  policies?: RepositoryAdapter<any>
}

export interface PublicRatesQuery {
  checkIn: string
  checkOut: string
  /** Cantidad de habitaciones requeridas — informativo; la disponibilidad se calcula por type. */
  rooms?: number
  /** Huéspedes (adults). Default 2 (mismo default que availability.check). */
  guests?: number
  /** Moneda en la que el cliente quiere ver los precios. Default = hotels.currency. */
  currency?: string
}

interface TaxRow { name: string; rate: number }

/**
 * No usamos `NotFoundError` para el 404 del hotel: el endpoint es público y la respuesta
 * es un objeto `{status, body}` que el controller devuelve as-is (mismo patrón que
 * `public-booking.ts:getPublicBookingBySlug`). Lanzar NotFoundError acá rompería la
 * simetría con el resto de los handlers públicos.
 */
export async function getPublicRates(
  deps: PublicRatesDeps,
  slug: string,
  query: PublicRatesQuery,
): Promise<{ status: number; body: any }> {
  if (!slug) return { status: 404, body: { error: 'Hotel not found' } }
  if (!query.checkIn || !query.checkOut) {
    return { status: 400, body: { error: 'checkIn y checkOut son requeridos' } }
  }
  if (query.checkIn >= query.checkOut) {
    return { status: 400, body: { error: 'checkOut debe ser posterior a checkIn' } }
  }

  // Anti-enumeración: idéntico 404 para "no existe" y "no activo".
  const hotel = await deps.hotels.findOne({ slug })
  if (!hotel || hotel.onlineBookingStatus !== 'active') {
    return { status: 404, body: { error: 'Hotel not found' } }
  }

  // FIX — toggle "Activo/Inactivo" del admin (`/panel/booking-engine`) ahora sí apaga el
  // motor. Mismo 404 anti-enumeración que `onlineBookingStatus` (no revelar por qué está
  // apagado). `enabled` default es `true` (config.ts get()) — un hotel que nunca tocó esta
  // pantalla no se ve afectado.
  const bookingConfig = deps.bookingConfig ? await deps.bookingConfig.findOne({ hotelId: hotel.id }) : null
  if (bookingConfig && bookingConfig.enabled === false) {
    return { status: 404, body: { error: 'Hotel not found' } }
  }

  const sourceCurrency = String(hotel.currency || 'USD').toUpperCase()
  const nights = Math.max(1, Math.round(
    (new Date(query.checkOut).getTime() - new Date(query.checkIn).getTime()) / MS_PER_DAY,
  ))
  const adults = typeof query.guests === 'number' && query.guests > 0 ? query.guests : 2

  // FIX — minNights/maxNights configurados por el admin, antes decorativos. 400 claro (no
  // 404: el hotel SÍ existe y está activo, solo el rango de fechas no cumple la política).
  const minNights = Number(bookingConfig?.minNights) || 1
  const maxNights = Number(bookingConfig?.maxNights) || Infinity
  if (nights < minNights) {
    return { status: 400, body: { error: `Estadía mínima: ${minNights} noche${minNights === 1 ? '' : 's'}` } }
  }
  if (nights > maxNights) {
    return { status: 400, body: { error: `Estadía máxima: ${maxNights} noches` } }
  }

  // Disponibilidad via usecase existente (cacheado 60s).
  const availability = await deps.availability.checkAvailability({
    hotelId: hotel.id, checkIn: query.checkIn, checkOut: query.checkOut, adults,
  })

  // Tasas del hotel. Mismo fallback que folios/usecases/folio-math.ts:taxRateFor — si la
  // configuration('taxes') no está poblada, caemos a hotels.taxRate / hotels.taxName.
  const taxes = await readTaxes(deps.config, hotel.id, hotel)

  // Conversión de moneda. Si no hay rates o faltan monedas, degradamos a currency base.
  const targetCurrency = (query.currency && typeof query.currency === 'string')
    ? query.currency.toUpperCase()
    : sourceCurrency
  const rates = await readCurrencyRates(deps.config)
  const canConvert = !!rates && targetCurrency !== sourceCurrency &&
    typeof rates[sourceCurrency] === 'number' && typeof rates[targetCurrency] === 'number'
  const displayCurrency = canConvert ? targetCurrency : sourceCurrency
  const convert = (amount: number): number => {
    if (!canConvert || !rates) return round2(amount)
    // rates es base USD (openexchangerates free tier): rates.USD=1, rates.EUR=0.92, ...
    // amount_source → USD → target.
    const amountInUsd = amount / rates[sourceCurrency]
    return round2(amountInUsd * rates[targetCurrency])
  }

  const photoByType = await resolvePhotoByType(deps, hotel.id)

  const roomTypes = availability.roomTypes.map((rt) => {
    // `rt.price` es el precio por noche más bajo del type (availability.aggregate lo calcula).
    // × noches → total de la estadía para ese type (spec scenario "From $354 total").
    const fromPrice = convert((Number(rt.price) || 0) * nights)
    const taxBreakdown = taxes.map((t) => ({
      name: t.name,
      rate: t.rate,
      amount: round2((fromPrice * t.rate) / 100),
    }))
    return {
      id: rt.roomType,
      name: rt.roomType,
      fromPrice,
      availableCount: rt.available,
      capacity: rt.capacity,
      surfaceArea: rt.surfaceArea,
      taxBreakdown,
      photoUrl: photoByType.get(rt.roomType) ?? null,
    }
  })

  return {
    status: 200,
    body: {
      roomTypes,
      currency: displayCurrency,
      taxes: taxes.map((t) => ({ name: t.name, rate: t.rate })),
      nights,
      // D10 — El cobro SIEMPRE es en hotels.currency. El widget muestra prices en displayCurrency
      // pero al pagar, Stripe cobra en chargeCurrency. El frontend lo necesita para etiquetar el
      // botón de pago ("Se cobrará en DOP") y evitar sorpresas.
      chargeCurrency: sourceCurrency,
      // Eco de los params para que el frontend pueda validar lo que el backend computó.
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      // FIX — antes se guardaba en booking_config y nunca se exponía; el widget no tenía
      // forma de mostrarla aunque el admin la hubiera escrito.
      cancellationPolicy: bookingConfig?.cancellationPolicy || null,
      // F5 #627 — Política estructurada para mostrar al huésped (tiers + ventana gratuita).
      // resolvePolicy trae TODAS las políticas del hotel y aplica channel > base > preset > default.
      // Si no hay repo cableado o falla, queda null → el widget cae al texto libre de arriba.
      cancellationSummary: deps.policies
        ? await buildCancellationSummary(deps.policies, hotel.id, hotel.cancellationType)
        : null,
    },
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * Lee `configuration(key='taxes')` del hotel. Mismo shape que folio-math/facturas/billing:
 * array de `{ activo|active, tasa|rate, nombre|name }`. Si no hay config o está vacía, cae a
 * `hotels.taxRate` + `hotels.taxName` (lo que Configuración → Impuestos SÍ guarda).
 */
async function readTaxes(
  config: RepositoryAdapter<any>,
  hotelId: string,
  hotel: any,
): Promise<TaxRow[]> {
  try {
    const rows = await config.findMany({ hotelId, key: 'taxes' })
    const arr: any[] = rows?.[0]?.value ?? []
    const configured: TaxRow[] = arr
      .filter((t) => t && (t.activo ?? t.active) !== false)
      .map((t) => ({
        name: String(t.nombre ?? t.name ?? 'Tax'),
        rate: Number(t.tasa ?? t.rate ?? 0),
      }))
      .filter((t) => t.rate > 0)
    if (configured.length > 0) return configured
  } catch { /* cae al fallback */ }
  const rate = Number(hotel?.taxRate) || 0
  if (rate > 0) return [{ name: String(hotel?.taxName ?? 'Tax'), rate }]
  return []
}

/**
 * Lee `configuration(key='currency_rates', hotelId='platform')` escrito por el cron nightly.
 * Shape: `{ base: 'USD', rates: { USD: 1, EUR: 0.92, DOP: 58, ... } }`. Si no está poblado
 * (cron sin correr, sin OPENEXCHANGERATES_APP_ID), devuelve null → el caller degrada a la
 * currency base del hotel.
 */
async function readCurrencyRates(config: RepositoryAdapter<any>): Promise<Record<string, number> | null> {
  try {
    const rows = await config.findMany({ hotelId: 'platform', key: 'currency_rates' })
    const raw = rows?.[0]?.value
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const rates = parsed?.rates
    if (!rates || typeof rates !== 'object') return null
    return rates as Record<string, number>
  } catch {
    return null
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Resuelve una foto representativa por `room.type` string. No hay entidad RoomType propia
 * (ver comment de arriba): agrupa las rooms físicas del hotel por `type`, y para cada type
 * busca la primera `hotel_media(type='room')` entre esas rooms (ordenada por `sortOrder`
 * asc si una room tiene más de una foto). Sin foto asignada a ninguna room del type → no
 * está en el Map, el caller cae a `null` (no se inventa un placeholder acá).
 */
async function resolvePhotoByType(
  deps: Pick<PublicRatesDeps, 'rooms' | 'hotelMedia'>,
  hotelId: string,
): Promise<Map<string, string>> {
  if (!deps.rooms || !deps.hotelMedia) return new Map()
  const [rooms, media] = await Promise.all([
    deps.rooms.findMany({ hotelId }),
    deps.hotelMedia.findMany({ hotelId, type: 'room' }),
  ])

  const roomIdToPhoto = new Map<string, string>()
  const sortedMedia = [...(media as any[])].sort(
    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
  )
  for (const m of sortedMedia) {
    if (!m.roomId || roomIdToPhoto.has(m.roomId)) continue
    roomIdToPhoto.set(m.roomId, m.url)
  }

  const typeToRoomIds = new Map<string, string[]>()
  for (const r of rooms as any[]) {
    if (!r.type) continue
    const list = typeToRoomIds.get(r.type) ?? []
    list.push(r.id)
    typeToRoomIds.set(r.type, list)
  }

  const photoByType = new Map<string, string>()
  for (const [type, roomIds] of typeToRoomIds) {
    const photo = roomIds.map((id) => roomIdToPhoto.get(id)).find((url) => !!url)
    if (photo) photoByType.set(type, photo)
  }
  return photoByType
}

// Exportamos los helpers para tests (sin exponerlos vía el index del módulo — solo acá).
export const __test__ = { readTaxes, readCurrencyRates, round2, resolvePhotoByType, buildCancellationSummary }

// ─── F5 #627 — Cancellation Summary ──────────────────────────────────────────

/** Shape público del resumen de cancelación. Solo lo que el widget necesita para mostrar. */
export interface CancellationSummary {
  tiers: Tier[]
  /** Horas antes del checkIn hasta las cuales se puede cancelar gratis (penaltyPercent=0).
   *  null si no hay ventana gratuita (non_refundable: 100% siempre). */
  freeUntilHours: number | null
  /** Descripción legible de qué pasa después de la ventana gratuita. */
  penaltyDescription: string
  /** Fuente: 'custom' (política propia del hotel) | 'preset' (mapeada de cancellationType) | 'default'. */
  source: 'custom' | 'preset' | 'default'
}

/**
 * Resuelve la política de cancelación del hotel y la formatea para display público.
 *
 * `freeUntilHours` = deadlineHours del tier con penaltyPercent=0 más generoso (mayor deadlineHours).
 * `penaltyDescription` = resumen legible de los tiers con penalty > 0.
 *
 * Degradación graceful: si el repo falla o no hay políticas, devuelve null (el caller cae al
 * texto libre `cancellationPolicy` del booking_config).
 */
async function buildCancellationSummary(
  policyRepo: RepositoryAdapter<any>,
  hotelId: string,
  hotelCancellationType?: string | null,
): Promise<CancellationSummary | null> {
  try {
    const policy = await resolvePolicy(policyRepo, hotelId, undefined, hotelCancellationType)
    const freeTiers = policy.tiers.filter((t) => t.penaltyPercent === 0)
    // El tier gratuito más generoso: mayor deadlineHours (más tiempo para cancelar gratis).
    const freeUntilHours = freeTiers.length > 0
      ? Math.max(...freeTiers.map((t) => t.deadlineHours))
      : null

    // Descripción legible de la penalidad.
    const penaltyTiers = policy.tiers.filter((t) => t.penaltyPercent > 0)
    let penaltyDescription: string
    if (penaltyTiers.length === 0) {
      penaltyDescription = 'Cancelación gratuita en cualquier momento'
    } else if (penaltyTiers.some((t) => t.penaltyPercent >= 100 && !t.refundable)) {
      penaltyDescription = 'No reembolsable'
    } else {
      const max = Math.max(...penaltyTiers.map((t) => t.penaltyPercent))
      penaltyDescription = `Después: hasta ${max}% de penalización`
    }

    return {
      tiers: policy.tiers,
      freeUntilHours,
      penaltyDescription,
      source: policy.source,
    }
  } catch {
    return null
  }
}
