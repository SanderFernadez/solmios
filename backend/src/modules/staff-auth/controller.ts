// controller.ts — StaffAuth
import type { HttpRequest, Logger } from 'arckode-framework'
import type { StaffAuthService } from './service'
import { PinLoginSchema, PinSetSchema } from './validators/schema'

export class StaffAuthController {
  constructor(
    private readonly service: StaffAuthService,
    private readonly logger: Logger,
  ) {}

  async loginByPin(req: HttpRequest) {
    const body = (req.body || {}) as Record<string, unknown>
    if (!body?.phone || !body?.pin) {
      return { status: 400, body: { error: 'phone y pin son requeridos' } }
    }
    const data = PinLoginSchema.parse(body)
    const result = await this.service.loginByPin(data as any)
    return { status: 200, body: result }
  }

  async setPin(req: HttpRequest) {
    const body = (req.body || {}) as Record<string, unknown>
    const userId = req.params.userId || body?.userId as string
    const pin = body?.pin as string

    if (!userId || !pin) {
      return { status: 400, body: { error: 'userId y pin son requeridos' } }
    }

    const adminId = (req.user as any)?.id
    if (!adminId) {
      return { status: 401, body: { error: 'No autenticado' } }
    }

    await this.service.setPin(userId, pin, adminId)
    return { status: 200, body: { message: 'PIN configurado correctamente' } }
  }

  async resetPin(req: HttpRequest) {
    const userId = req.params.userId
    if (!userId) {
      return { status: 400, body: { error: 'userId requerido' } }
    }

    const adminId = (req.user as any)?.id
    if (!adminId) {
      return { status: 401, body: { error: 'No autenticado' } }
    }

    await this.service.resetPin(userId, adminId)
    return { status: 200, body: { error: 'PIN reseteado correctamente' } }
  }
}
