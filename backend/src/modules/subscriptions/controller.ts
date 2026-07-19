import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { SubscriptionsService } from './service'
import { SignupSchema } from './validators/schema'

export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly logger: Logger,
  ) {}

  /**
   * Alta pública: sin token, cualquiera crea su hotel y arranca la prueba.
   * La ruta va con rate-limit porque es la única puerta abierta que escribe.
   */
  async signup(req: HttpRequest) {
    const data = validateSchema(SignupSchema, req.body ?? {}) as any
    const result = await this.service.signup(data)
    return { status: 201, body: { data: result } }
  }

  /** Planes visibles para quien todavía no es cliente (la landing y el registro). */
  async publicPlans(_req: HttpRequest) {
    return { status: 200, body: { data: await this.service.publicPlans() } }
  }

  /** Estado de la suscripción del hotel logueado: qué le queda y si tiene que pagar. */
  async myStatus(req: HttpRequest) {
    const hotelId = (req.user as any)?.hotelId
    return { status: 200, body: { data: await this.service.statusOf(hotelId) } }
  }
}
