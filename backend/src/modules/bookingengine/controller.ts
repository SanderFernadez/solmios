// bookingengine/controller.ts — Adaptador HTTP del módulo
// Endpoints protegidos (admin) + endpoints públicos (sin auth) + Stripe webhook

import type { HttpRequest, Logger, RepositoryAdapter } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { BookingengineService } from './service'
import type { AvailabilityQuery, CreatePublicBookingDTO, CreateConversionEventDTO, UpdateBookingConfigDTO } from './types'
import {
  UpdateBookingConfigSchema,
  CheckAvailabilitySchema,
  CreatePublicBookingSchema,
  TrackEventSchema,
  CreateCheckoutSessionSchema,
} from './validators/schema'
import { getPublicBookingBySlug, createPublicBookingDirect } from './usecases/public-booking'
import { getPublicHotelInfo } from './usecases/public-hotel-info'
import { getPublicReservation } from './usecases/public-reservation'
import { listActiveHotelSlugs, buildSitemapXml, resolveBaseUrl } from './usecases/sitemap'

export class BookingengineController {
  constructor(
    private readonly service: BookingengineService,
    private readonly logger: Logger,
    private readonly orm?: any,
    private readonly auth?: any,
    private readonly pushAvailability?: (hotelId: string, roomId: string) => void,
    // Repositorio de hoteles para la ruta pública GET /api/public/hotel/:slug (F0 0.4).
    // Se pasa desde index.ts (donde ya existe hotelsRepo) en vez de instanciarlo acá:
    // el controller no debe saber del orm.define ni de nombres de modelo.
    private readonly hotelsRepo?: RepositoryAdapter<any>,
  ) {}

  // ─── Admin (protegido con auth) ──────────────────────

  async getConfig(req: HttpRequest) {
    this.logger.info('GET /booking-engine/config')
    const hotelId = (req as any).hotelId
    const config = await this.service.getConfig(hotelId)
    return { status: 200, body: config }
  }

  async updateConfig(req: HttpRequest) {
    this.logger.info('PUT /booking-engine/config')
    const hotelId = (req as any).hotelId
    const data = validateSchema(UpdateBookingConfigSchema, req.body) as UpdateBookingConfigDTO
    const config = await this.service.updateConfig(hotelId, data)
    return { status: 200, body: config }
  }

  async getAnalytics(req: HttpRequest) {
    this.logger.info('GET /booking-engine/analytics')
    const hotelId = (req as any).hotelId
    const { from, to } = req.query as { from?: string; to?: string }
    const analytics = await this.service.getAnalytics(hotelId, from, to)
    return { status: 200, body: analytics }
  }

  // ─── Público (sin auth) ──────────────────────────────

  async checkAvailability(req: HttpRequest) {
    this.logger.info('POST /api/public/availability')
    const data = validateSchema(CheckAvailabilitySchema, req.body) as unknown as AvailabilityQuery
    const result = await this.service.checkAvailability(data)
    return { status: 200, body: result }
  }

  async getHotelPublicInfo(req: HttpRequest) {
    this.logger.info('GET /api/public/hotel/:slug', { slug: req.params.slug })
    // lang default 'es' (D7 — fallback final español). Query opcional `?lang=en`.
    const lang = (req.query?.lang as string | undefined) || 'es'
    try {
      // Allow-list estricta en el usecase: el DTO devuelto SOLO contiene campos públicos
      // (ver spec public-hotel-info). Nunca spread del hotel.
      const dto = await getPublicHotelInfo(
        { hotels: this.hotelsRepo! },
        String(req.params?.slug || ''),
        lang,
      )
      return { status: 200, body: dto }
    } catch (e: any) {
      // NotFoundError → 404 plano. Anti-enumeración: el usecase tira el MISMO mensaje para
      // "no existe" y "no activo" (no filtrar hoteles pausados).
      if (e?.httpStatus === 404) return { status: 404, body: { error: e.message } }
      throw e
    }
  }

  async createBooking(req: HttpRequest) {
    this.logger.info('POST /api/public/bookings')
    const data = validateSchema(CreatePublicBookingSchema, req.body) as unknown as CreatePublicBookingDTO
    const booking = await this.service.createBooking(data)
    return { status: 201, body: booking }
  }

  async createCheckoutSession(req: HttpRequest) {
    this.logger.info('POST /api/public/bookings/:id/checkout')
    const { id } = req.params
    const data = validateSchema(CreateCheckoutSessionSchema, req.body) as any
    const session = await this.service.createCheckoutSession(id, data.successUrl, data.cancelUrl)
    return { status: 200, body: session }
  }

  /**
   * Webhook del motor de reservas. El hotel va en la RUTA: hay que saber de quién es el secreto
   * de firma ANTES de creerle al body. Sin verificación, cualquiera podría confirmar una reserva
   * sin pagarla mandando un POST acá.
   *
   * La firma se verifica contra los bytes CRUDOS (`req.rawBody`, framework >= 1.6.3).
   */
  async handleStripeWebhook(req: HttpRequest) {
    const hotelId = String(req.params?.hotelId || '')
    if (!hotelId) return { status: 400, body: { error: 'Falta el hotel en la ruta del webhook' } }

    const signature = (req as any).headers?.['stripe-signature'] || ''
    const rawBody = (req as any).rawBody
    if (!rawBody) return { status: 400, body: { error: 'Webhook sin body' } }

    try {
      const result = await this.service.handleStripeWebhook(hotelId, rawBody, signature)
      if (!result) return { status: 400, body: { error: 'Firma inválida' } }
      return { status: 200, body: result }
    } catch (e: any) {
      this.logger.error(`Webhook de reservas (hotel ${hotelId}): ${e?.message}`)
      return { status: 400, body: { error: e?.message || 'Webhook rechazado' } }
    }
  }

  async getBooking(req: HttpRequest) {
    this.logger.info('GET /api/public/bookings/:id', { id: req.params.id })
    const booking = await this.service.getBooking(req.params.id)
    return { status: 200, body: booking }
  }

  /**
   * F0 0.14 — Endpoint público SEGURO para consultar reserva por id + token.
   * Reemplaza al IDOR abierto `GET /api/public/bookings/:id`. Anti-enumeración:
   * mismo 404 para "no existe / sin token / token incorrecto / accessToken null".
   * El token se valida con HMAC-SHA256 + timingSafeEqual (anti timing attack).
   */
  async getPublicReservation(req: HttpRequest) {
    this.logger.info('GET /api/public/reservations/:id', { id: req.params.id })
    const token = (req.query?.token as string | undefined) || undefined
    return getPublicReservation(this.orm, String(req.params?.id || ''), token)
  }

  async trackEvent(req: HttpRequest) {
    this.logger.info('POST /api/public/events')
    const data = validateSchema(TrackEventSchema, req.body) as unknown as CreateConversionEventDTO
    const event = await this.service.trackEvent(data)
    return { status: 201, body: event }
  }

  async getPublicBookingBySlug(req: HttpRequest) {
    return getPublicBookingBySlug(this.orm, req.params.slug, req.query || {})
  }

  async createPublicBookingDirect(req: HttpRequest) {
    // F0 0.16 — Pasamos el service (con `createReservationCheckout`) y el logger al usecase
    // para que pueda crear la Checkout Session tras crear la reserva pending. Si Stripe falla,
    // el usecase devuelve `checkoutUrl: null` + `paymentError` (reserva NO se pierde).
    //
    // successUrl/cancelUrl: el widget (F2) las va a mandar en el body. Si no llegan, derivamos
    // de `PUBLIC_BASE_URL` (env) para que el flujo no rompa en prod. El pattern de la URL de
    // vuelta es `/h/:slug?booking=:id&token=:token` (spec booking-unification R2) — lo arma el
    // frontend; el backend solo se asegura de tener URLs válidas para mandarle a Stripe.
    const body = (req.body || {}) as { successUrl?: string; cancelUrl?: string }
    const baseUrl = process.env.PUBLIC_BASE_URL || publicBaseFromRequest(req)
    const successUrl = body.successUrl || (baseUrl ? `${baseUrl}/booking/success` : '')
    const cancelUrl = body.cancelUrl || (baseUrl ? `${baseUrl}/booking/cancel` : '')
    const stripeUrls = successUrl && cancelUrl ? { successUrl, cancelUrl } : undefined
    return createPublicBookingDirect(
      this.orm, req.body,
      this.pushAvailability, this.auth,
      this.service, this.logger,
      stripeUrls,
    )
  }

  /**
   * F1 1.11 — Sitemap dinámico (`GET /sitemap.xml`). Lista `/h/:slug` por cada hotel con
   * `onlineBookingStatus='active'`. Público (sin auth), cache-friendly. Devuelve XML crudo
   * con su Content-Type (mismo patrón que `facturas/print` y `capacitacion` para HTML/PDF).
   */
  async getSitemap(req: HttpRequest) {
    this.logger.info('GET /sitemap.xml')
    const urls = await listActiveHotelSlugs({ hotels: this.hotelsRepo! })
    const baseUrl = resolveBaseUrl(req)
    const xml = buildSitemapXml(baseUrl, urls)
    return {
      status: 200,
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': SITEMAP_CACHE_CONTROL },
      body: xml,
    }
  }
}

/**
 * Cache-Control del sitemap: 1h (3600s). Es el TTL que recomendamos para crawlers — el listado
 * de hoteles activos cambia poco (alta/baja de motor público) y un refresco horario alcanza.
 */
const SITEMAP_CACHE_CONTROL = 'public, max-age=3600'

/**
 * F0 0.16 — Deriva la base pública del widget desde el request cuando `PUBLIC_BASE_URL` no
 * está seteada. Lee el `Origin`/`Referer` del request (headers que manda el navegador) y
 * construye `https://host`. Si no puede derivarla, devuelve '' (string vacío) — el usecase
 * omite el cobro y devuelve `checkoutUrl:null`, sin romper la creación de la reserva.
 *
 * El slug del hotel NO se incluye acá: el widget construye la URL final `/h/:slug?booking=...`
 * del lado del frontend (F2/0.20). Acá solo aseguramos una base válida para que Stripe sepa
 * a qué dominio volver.
 */
function publicBaseFromRequest(req: HttpRequest): string {
  const headers = (req as any).headers || {}
  const origin = headers['origin'] || headers['Origin']
  if (origin && typeof origin === 'string') return origin.replace(/\/$/, '')
  const referer = headers['referer'] || headers['Referer']
  if (referer && typeof referer === 'string') {
    try {
      const u = new URL(referer as string)
      return `${u.protocol}//${u.host}`
    } catch { /* referer malformado → caemos al host header */ }
  }
  const host = headers['host'] || headers['Host']
  if (host && typeof host === 'string') {
    // El widget se sirve por HTTPS en prod (siempre). En dev (HTTP localhost) el schema lo
    // infiere `x-forwarded-proto` si está (Cloudflare/nginx), si no asume https.
    const proto = headers['x-forwarded-proto'] || 'https'
    return `${proto}://${host}`
  }
  return ''
}
