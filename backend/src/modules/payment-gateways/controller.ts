// payment-gateways/controller.ts — Adaptador HTTP.

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PaymentGatewaysService } from './service'
import { UpsertPaymentGatewaySchema } from './validators/schema'
import type { UpsertPaymentGatewayDTO } from './types'

export class PaymentGatewaysController {
  constructor(
    private readonly service: PaymentGatewaysService,
    private readonly logger: Logger,
  ) {}

  /**
   * El hotel sale del TOKEN, nunca de la query. Si aceptáramos ?hotelId=, cualquier usuario
   * podría leer o pisar las credenciales de cobro de otro hotel (el IDOR que ya cerramos en
   * ttlock/pricing/amenities). Acá el botín serían las llaves que mueven el dinero.
   */
  private hotelOf(req: any): string | undefined {
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return String(userHotel)
    if (req?.user?.role === 'super_admin' && req?.query?.hotelId) return String(req.query.hotelId)
    return undefined
  }

  async list(req: HttpRequest) {
    const hotelId = this.hotelOf(req)
    if (!hotelId) return { status: 401, body: { error: 'Hotel no encontrado' } }
    return { status: 200, body: { data: await this.service.list(hotelId) } }
  }

  async upsert(req: HttpRequest) {
    const hotelId = this.hotelOf(req)
    if (!hotelId) return { status: 401, body: { error: 'Hotel no encontrado' } }
    const data = validateSchema(UpsertPaymentGatewaySchema, req.body) as unknown as UpsertPaymentGatewayDTO
    return { status: 200, body: await this.service.upsert(hotelId, data) }
  }

  async setEnabled(req: HttpRequest) {
    const hotelId = this.hotelOf(req)
    if (!hotelId) return { status: 401, body: { error: 'Hotel no encontrado' } }
    const enabled = Boolean((req.body as any)?.enabled)
    return { status: 200, body: await this.service.setEnabled(hotelId, req.params.id, enabled) }
  }

  async remove(req: HttpRequest) {
    const hotelId = this.hotelOf(req)
    if (!hotelId) return { status: 401, body: { error: 'Hotel no encontrado' } }
    await this.service.remove(hotelId, req.params.id)
    return { status: 200, body: { success: true } }
  }

  async testConnection(req: HttpRequest) {
    const hotelId = this.hotelOf(req)
    if (!hotelId) return { status: 401, body: { error: 'Hotel no encontrado' } }
    const result = await this.service.testConnection(hotelId, req.params.id)
    return { status: result.ok ? 200 : 400, body: result }
  }
}
