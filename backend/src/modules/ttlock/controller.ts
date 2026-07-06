import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { TtlockService } from './service'
import { UpdateTTLockConfigSchema, ConnectTTLockSchema, UpdateLockDeviceSchema } from './validators/schema'

export class TtlockController {
  constructor(
    private readonly service: TtlockService,
    private readonly logger: Logger,
  ) {}

  private async hotelOf(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    if (q.hotelId) return q.hotelId as string
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    if (req?.user?.id && req?.user?.role !== 'super_admin') {
      const uRows = await (this.service as any).orm?.findMany?.('Users', { id: req.user.id }) || []
      const u: any = uRows?.[0]
      if (u?.hotelId) return u.hotelId
    }
    return undefined
  }

  async getConfig(req: HttpRequest) {
    const id = await this.hotelOf(req)
    if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
    return { status: 200, body: await this.service.getConfig(id) }
  }

  async updateConfig(req: HttpRequest) {
    const id = await this.hotelOf(req)
    if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
    const data = validateSchema(UpdateTTLockConfigSchema, req.body) as any
    await this.service.updateConfig(id, data)
    return { status: 200, body: { success: true } }
  }

  async connect(req: HttpRequest) {
    const id = await this.hotelOf(req)
    if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
    try {
      const data = validateSchema(ConnectTTLockSchema, req.body) as any
      await this.service.connect(id, data)
      return { status: 200, body: { success: true, connected: true } }
    } catch (e: any) {
      return { status: 502, body: { error: e.message || 'No se pudo conectar con TTLock' } }
    }
  }

  async listLocks(req: HttpRequest) {
    const id = await this.hotelOf(req)
    if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.listLocks(id) } }
  }

  async syncLocks(req: HttpRequest) {
    const id = await this.hotelOf(req)
    if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
    try {
      const synced = await this.service.syncLocks(id)
      return { status: 200, body: { success: true, synced, message: `${synced} cerradura(s) sincronizada(s)` } }
    } catch (e: any) {
      return { status: 400, body: { error: e.message } }
    }
  }

  async generateCode(req: HttpRequest) {
    const id = await this.hotelOf(req)
    if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
    try {
      const code = await this.service.generateCode(id, req.params.reservationId)
      return { status: 201, body: code }
    } catch (e: any) {
      if (e.message.includes('no encontrado')) return { status: 404, body: { error: e.message } }
      if (e.message.includes('Sin acceso')) return { status: 403, body: { error: e.message } }
      return { status: 400, body: { error: e.message } }
    }
  }

  async revokeCode(req: HttpRequest) {
    await this.service.revokeCode(req.params.id)
    return { status: 200, body: { success: true } }
  }

  async updateLock(req: HttpRequest) {
    const id = await this.hotelOf(req)
    const data = validateSchema(UpdateLockDeviceSchema, req.body) as any
    return { status: 200, body: await this.service.updateLock(req.params.id, data, id) }
  }
}
