// marketing/controller.ts
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { MarketingService } from './service'
import { CreateAutoMessageSchema, CreateTemplateSchema } from './validators/schema'
import type { CreateAutoMessageDTO, CreateWhatsappTemplateDTO } from './types'

export class MarketingController {
  constructor(private readonly service: MarketingService, private readonly logger: Logger) {}

  async listAutoMessages(req: HttpRequest) { const h = (req as any).hotelId; return { status: 200, body: { data: await this.service.listAutoMessages(h) } } }
  async createAutoMessage(req: HttpRequest) {
    const d = validateSchema(CreateAutoMessageSchema, req.body) as any; d.hotelId = (req as any).hotelId ?? d.hotelId
    return { status: 201, body: await this.service.createAutoMessage(d) }
  }
  async updateAutoMessage(req: HttpRequest) { return { status: 200, body: await this.service.updateAutoMessage(req.params.id, req.body as any) } }
  async deleteAutoMessage(req: HttpRequest) { await this.service.deleteAutoMessage(req.params.id); return { status: 200, body: { success: true } } }

  async listMessageLogs(req: HttpRequest) {
    const h = (req as any).hotelId; const { reservationId } = req.query as any
    return { status: 200, body: { data: await this.service.listMessageLogs(h, reservationId) } }
  }
  async createMessageLog(req: HttpRequest) {
    const d = req.body as any; d.hotelId = (req as any).hotelId ?? d.hotelId
    return { status: 201, body: await this.service.createMessageLog(d) }
  }

  async listTemplates(req: HttpRequest) { const h = (req as any).hotelId; return { status: 200, body: { data: await this.service.listTemplates(h) } } }
  async createTemplate(req: HttpRequest) {
    const d = req.body as CreateWhatsappTemplateDTO; d.hotelId = (req as any).hotelId ?? d.hotelId
    if (!d.name) return { status: 400, body: { error: 'name requerido' } }
    return { status: 201, body: await this.service.createTemplate(d) }
  }
  async updateTemplate(req: HttpRequest) { return { status: 200, body: await this.service.updateTemplate(req.params.id, req.body as any) } }
  async deleteTemplate(req: HttpRequest) { await this.service.deleteTemplate(req.params.id); return { status: 200, body: { success: true } } }
}
