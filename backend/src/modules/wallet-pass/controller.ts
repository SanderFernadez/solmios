// wallet-pass/controller.ts — Adaptador HTTP del módulo (F3, spec wallet-pass).
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
//
// Rutas (registradas en index.ts, todas admin con auth + permiso settings:*, mismo criterio
// que ttlock — el pass se administra junto al módulo de cerraduras):
//   GET /api/wallet-pass/reservation/:reservationId  → get by reservation (admin)
//   GET /api/wallet-pass                              → list (paginado, multi-tenant)
//
// No hay POST/PUT/DELETE: el pass se genera automáticamente al confirmar la reserva (connector
// reservas-wallet + onBookingPaid). El admin lo consulta, no lo crea manualmente.
import type { HttpRequest, Logger } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { WalletPassService } from './service'
import type { WalletPassQuery, CurrentUser } from './types'

export class WalletPassController {
  constructor(
    private readonly service: WalletPassService,
    private readonly logger: Logger,
  ) {}

  /** Extrae el usuario actual del request. Si no hay sesión → 401. */
  private user(req: HttpRequest): CurrentUser {
    const u = (req as any).user
    if (!u) throw new AuthError('No autenticado')
    return { id: u.id, role: u.role, hotelId: u.hotelId }
  }

  /** GET /api/wallet-pass/reservation/:reservationId — pass por reserva. */
  async getByReservation(req: HttpRequest) {
    const user = this.user(req)
    const reservationId = String(req.params?.reservationId ?? '')
    if (!reservationId) return { status: 400, body: { error: 'reservationId requerido' } }
    this.logger.info('GET /api/wallet-pass/reservation/:reservationId', { reservationId, hotelId: user.hotelId })
    const pass = await this.service.getByReservation(reservationId, user)
    return { status: 200, body: pass }
  }

  /** GET /api/wallet-pass — listado paginado. */
  async index(req: HttpRequest) {
    const user = this.user(req)
    const q = (req.query ?? {}) as WalletPassQuery
    this.logger.info('GET /api/wallet-pass', { hotelId: user.hotelId })
    const result = await this.service.list(q, user)
    return { status: 200, body: result }
  }
}
