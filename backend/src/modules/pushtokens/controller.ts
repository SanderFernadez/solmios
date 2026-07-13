// pushtokens/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM.
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema().

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PushTokensService } from './service'
import type { PushUser, RegisterPushTokenDTO } from './types'
import { RegisterPushTokenSchema, UnregisterPushTokenSchema } from './validators/schema'

export class PushTokensController {
  constructor(
    private readonly service: PushTokensService,
    private readonly logger: Logger,
  ) {}

  /**
   * El dueño del token sale SIEMPRE del JWT, nunca del body: si viniera del
   * cliente, cualquiera registraría su teléfono a nombre de otro y le leería
   * los avisos.
   */
  /** Lista los tokens del hotel del usuario (admin de dispositivos). Multi-tenant por hotelId en el service. */
  async list(req: HttpRequest) {
    const user = req.user as unknown as PushUser
    const items = await this.service.list(user)
    return { status: 200, body: items }
  }

  async register(req: HttpRequest) {
    const user = req.user as unknown as PushUser
    const data = validateSchema(RegisterPushTokenSchema, req.body) as unknown as RegisterPushTokenDTO
    const item = await this.service.register(data, user)
    return { status: 201, body: item }
  }

  async unregister(req: HttpRequest) {
    const user = req.user as unknown as PushUser
    const data = validateSchema(UnregisterPushTokenSchema, req.body) as unknown as { token: string }
    await this.service.unregister(data.token, user)
    this.logger.info('Token de push dado de baja', { userId: user.id })
    return { status: 200, body: { message: 'Dispositivo dado de baja' } }
  }
}
