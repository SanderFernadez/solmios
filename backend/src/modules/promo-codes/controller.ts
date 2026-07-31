// promo-codes/controller.ts — Adaptador HTTP del módulo promo_codes (F2 booking-widget).
// Responsabilidad ÚNICA: traducir request → service → response. SIN lógica de negocio,
// SIN llamadas directas al ORM. Toda mutación (POST/PUT) pasa por validateSchema.
import type { HttpRequest, Logger, RepositoryAdapter } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { PromoCodesService } from './service'
import {
  CreatePromoCodeSchema,
  UpdatePromoCodeSchema,
  ValidatePromoCodeSchema,
} from './validators/schema'

export class PromoCodesController {
  constructor(
    private readonly service: PromoCodesService,
    private readonly logger: Logger,
    /** Repo `Hotels` para resolver slug → hotelId en el endpoint público (anti-IDOR:
     * el huésped manda el slug público, no el hotelId interno). */
    private readonly hotelsRepo: RepositoryAdapter<any>,
  ) {}

  // ─── Admin (auth + permiso promo:*) ───────────────────────────────────────

  /** GET /api/promo-codes — lista los códigos del hotel del admin. */
  async index(req: HttpRequest) {
    const user = req.user as any
    this.logger.info('GET /api/promo-codes', { hotelId: user?.hotelId })
    const result = await this.service.list(user)
    return { status: 200, body: result }
  }

  /** POST /api/promo-codes — alta de un código. */
  async store(req: HttpRequest) {
    const user = req.user as any
    const data = validateSchema(CreatePromoCodeSchema, req.body)
    const created = await this.service.create(data as any, user)
    return { status: 201, body: created }
  }

  /** PUT /api/promo-codes/:id — edición (partial). */
  async update(req: HttpRequest) {
    const user = req.user as any
    const data = validateSchema(UpdatePromoCodeSchema, req.body)
    const updated = await this.service.update(req.params.id, data as any, user)
    return { status: 200, body: updated }
  }

  /** DELETE /api/promo-codes/:id — borrado físico. */
  async destroy(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.remove(req.params.id, user)
    return { status: 200, body: result }
  }

  /**
   * POST /api/promo-codes/preview — valida un código contra el hotel del usuario autenticado.
   * FIX 2026-07-31: el wizard de reserva manual del staff necesita previsualizar el descuento
   * sin requerir permiso `promo:view` (receptionist crea reservas pero no administra códigos).
   * hotelId sale del token (nunca del body) — no hay IDOR posible.
   */
  async previewForUser(req: HttpRequest) {
    const user = req.user as any
    const data = validateSchema(ValidatePromoCodeSchema, req.body) as { code: string; subtotal: number }
    const result = await this.service.validate(String(user.hotelId), data.code, data.subtotal)
    return { status: 200, body: result }
  }

  // ─── Público (sin auth, rate-limited en index.ts) ─────────────────────────

  /**
   * POST /api/public/hotels/:slug/promo/validate — valida un código y devuelve
   * el descuento calculado sobre el subtotal. Sin auth (rate-limited por IP).
   *
   * Anti-enumeración: si el hotel no existe o `onlineBookingStatus !== 'active'`,
   * respondemos `not_found` plano (no revelar existencia del code ni del hotel).
   */
  async validateBySlug(req: HttpRequest) {
    const slug = String(req.params?.slug || '')
    const data = validateSchema(ValidatePromoCodeSchema, req.body) as { code: string; subtotal: number }
    const hotel = await this.hotelsRepo.findOne({ slug })
    if (!hotel || hotel.onlineBookingStatus !== 'active') {
      // Fail-cerrado: mismo shape que "code no existe" para no revelar el hotel.
      return {
        status: 200,
        body: { valid: false, discount: 0, reason: 'not_found' },
      }
    }
    const result = await this.service.validate(String(hotel.id), data.code, data.subtotal)
    return { status: 200, body: result }
  }
}
