// server-tracking/controller.ts — Adaptador HTTP del módulo (F3, spec server-tracking).
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)
//
// Rutas (registradas en index.ts, todas admin con auth + permiso settings:edit):
//   POST /api/server-tracking/test        → dispara evento test a Meta + GA4
//   GET  /api/server-tracking/events      → historial para auditoría
//
// El endpoint "config" lo sirve el módulo `configuration` genérico (ConfigurationModule
// ya expone GET/POST /api/configuracion con permiso settings:edit). NO lo duplicamos acá:
// las creds viajan como keys libres (meta_pixel_id, ga4_measurement_id, etc.) y el frontend
// las persiste con ConfigService.set (mismo patrón que reputation.vue).
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, AuthError } from 'arckode-framework'
import type { ServerTrackingService } from './service'
import type { EventsQuery } from './service'
import { TestFireSchema } from './validators/schema'
import type { CurrentUser } from './types'

export class ServerTrackingController {
  constructor(
    private readonly service: ServerTrackingService,
    private readonly logger: Logger,
  ) {}

  /** Extrae el usuario actual del request. Si no hay sesión → 401. */
  private user(req: HttpRequest): CurrentUser {
    const u = (req as any).user
    if (!u) throw new AuthError('No autenticado')
    return { id: u.id, role: u.role, hotelId: u.hotelId }
  }

  /**
   * POST /api/server-tracking/test — dispara evento de TEST a Meta + GA4.
   *
   * Body opcional: `{ reservationId?: string }`. Si se pasa, usa los datos de esa reserva
   * (sin PII — marketingAccepted forzado false en test). Si no, payload sintético.
   *
   * Devuelve `{ meta: FireResult, ga4: FireResult }` con status sent/failed/skipped por
   * cada externo. Skipped = no hay creds configuradas (no es error, es "nada que testear").
   */
  async testFire(req: HttpRequest) {
    const user = this.user(req)
    if (!user.hotelId) return { status: 400, body: { error: 'Sin hotel asignado' } }
    const body = req.body ?? {}
    const data = validateSchema(TestFireSchema, body) as { reservationId?: string }
    this.logger.info('POST /api/server-tracking/test', { hotelId: user.hotelId, reservationId: data.reservationId })
    try {
      const result = await this.service.fireTest(user.hotelId, data.reservationId)
      return { status: 200, body: { hotelId: user.hotelId, ...result } }
    } catch (e) {
      return { status: 400, body: { error: (e as Error).message } }
    }
  }

  /**
   * GET /api/server-tracking/events — historial para auditoría (spec.md "Persistencia
   * de eventos para auditoría" + scenario "Auditoría"). Filtra por hotelId del JWT.
   *
   * Query params: ?reservationId=&target=&status=&limit= (todos opcionales).
   */
  async events(req: HttpRequest) {
    const user = this.user(req)
    if (!user.hotelId) return { status: 400, body: { error: 'Sin hotel asignado' } }
    const q = (req.query ?? {}) as EventsQuery
    this.logger.info('GET /api/server-tracking/events', { hotelId: user.hotelId, filters: q })
    const events = await this.service.listEvents(q, user.hotelId)
    return { status: 200, body: { data: events, total: events.length } }
  }
}
