import type { Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AiRecepcionistaService } from './service'
import { AiRecepcionistaValidator } from './validators/schema'

export class AiRecepcionistaController {
  constructor(
    private readonly service: AiRecepcionistaService,
    private readonly logger: Logger,
  ) {}

  // ─── Conversations ──────────────────────────────────────────────────────

  async index(req: any) {
    const user = req.user || {}
    const query = req.query || {}
    const result = await this.service.listConversations(query, user)
    return { status: 200, body: { data: result.data, total: result.total, page: result.page, limit: result.limit, pages: result.pages } }
  }

  async show(req: any) {
    const user = req.user || {}
    const result = await this.service.getConversation(req.params.id, user)
    return { status: 200, body: result }
  }

  async close(req: any) {
    const user = req.user || {}
    const { resolvedBy, satisfactionScore } = req.body || {}
    const result = await this.service.closeConversation(req.params.id, resolvedBy || 'agent', satisfactionScore, user)
    return { status: 200, body: result }
  }

  async transfer(req: any) {
    const user = req.user || {}
    const { agentId, reason } = req.body || {}
    const result = await this.service.transferConversation(req.params.id, agentId || null, reason, user)
    return { status: 200, body: result }
  }

  // ─── Messages ───────────────────────────────────────────────────────────

  async sendMessage(req: any) {
    const body: any = req.body || {}
    validateSchema(AiRecepcionistaValidator.createMessage as any, body)
    const msg = await this.service.sendMessage(body)
    return { status: 201, body: msg }
  }

  // ─── Intents ────────────────────────────────────────────────────────────

  async listIntents(req: any) {
    const user = req.user || {}
    const query = req.query || {}
    const hotelId = user.hotelId || ''
    if (hotelId) await this.service.seedSystemIntents(hotelId)
    const result = await this.service.listIntents(query, user)
    return { status: 200, body: result }
  }

  async getIntent(req: any) {
    const user = req.user || {}
    const result = await this.service.getIntent(req.params.id, user)
    return { status: 200, body: result }
  }

  async createIntent(req: any) {
    const user = req.user || {}
    const body: any = req.body || {}
    validateSchema(AiRecepcionistaValidator.createIntent as any, body)
    const result = await this.service.createIntent(body, user)
    return { status: 201, body: result }
  }

  async updateIntent(req: any) {
    const user = req.user || {}
    const body: any = req.body || {}
    validateSchema(AiRecepcionistaValidator.updateIntent as any, body)
    const result = await this.service.updateIntent(req.params.id, body, user)
    return { status: 200, body: result }
  }

  async deleteIntent(req: any) {
    const user = req.user || {}
    await this.service.deleteIntent(req.params.id, user)
    return { status: 200, body: { success: true } }
  }

  async testIntent(req: any) {
    const user = req.user || {}
    const { message } = req.body || {}
    if (!message) return { status: 400, body: { error: 'message es requerido' } }
    const result = await this.service.testIntent(req.params.id, message, user)
    return { status: 200, body: result }
  }

  // ─── Templates ──────────────────────────────────────────────────────────

  async listTemplates(req: any) {
    const user = req.user || {}
    const query = req.query || {}
    const result = await this.service.listTemplates(query, user)
    return { status: 200, body: result }
  }

  async createTemplate(req: any) {
    const user = req.user || {}
    const body: any = req.body || {}
    validateSchema(AiRecepcionistaValidator.createTemplate as any, body)
    const result = await this.service.createTemplate(body, user)
    return { status: 201, body: result }
  }

  async updateTemplate(req: any) {
    const user = req.user || {}
    const body: any = req.body || {}
    validateSchema(AiRecepcionistaValidator.updateTemplate as any, body)
    const result = await this.service.updateTemplate(req.params.id, body, user)
    return { status: 200, body: result }
  }

  async deleteTemplate(req: any) {
    const user = req.user || {}
    await this.service.deleteTemplate(req.params.id, user)
    return { status: 200, body: { success: true } }
  }

  // ─── WhatsApp Config ────────────────────────────────────────────────────

  async getWhatsappConfig(req: any) {
    const user = req.user || {}
    const config = await this.service.getWhatsappConfig(req.query?.hotelId || '', user)
    return { status: 200, body: config }
  }

  async updateWhatsappConfig(req: any) {
    const user = req.user || {}
    const body: any = req.body || {}
    validateSchema(AiRecepcionistaValidator.createWhatsappConfig as any, body)
    const result = await this.service.updateWhatsappConfig(body, user)
    return { status: 200, body: result }
  }

  // ─── WhatsApp Webhook ───────────────────────────────────────────────────

  async whatsappWebhookVerify(req: any) {
    const mode = req.query?.['hub.mode']
    const token = req.query?.['hub.verify_token']
    const challenge = req.query?.['hub.challenge']
    const hotelId = req.params?.hotelId

    if (mode === 'subscribe' && token && challenge && hotelId) {
      const configs = await (this.service as any).whatsappConfigRepo.findMany({ hotelId })
      const cfg = configs[0]
      if (cfg && cfg.verifyToken === token) {
        return { status: 200, body: String(challenge), headers: { 'Content-Type': 'text/plain' } }
      }
    }
    return { status: 403, body: 'Verification failed' }
  }

  async whatsappWebhookReceive(req: any) {
    const hotelId = req.params?.hotelId
    const body: any = req.body || {}

    try {
      const entry = body?.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages

      if (!messages || messages.length === 0) {
        return { status: 200, body: { status: 'no_messages' } }
      }

      for (const msg of messages) {
        const from = msg.from
        const text = msg.text?.body || ''

        if (!text) continue

        const conv = await this.service.findOrCreateConversation({
          hotelId,
          channel: 'whatsapp',
          channelConversationId: from,
          guestPhone: from,
          guestName: value?.contacts?.[0]?.profile?.name || from,
          language: 'es',
        })

        await this.service.processIncomingMessage(conv.id, text, hotelId)
      }

      return { status: 200, body: { status: 'processed' } }
    } catch (err: any) {
      this.logger.error('WhatsApp webhook error', { hotelId, error: String(err) })
      return { status: 200, body: { status: 'error' } }
    }
  }

  // ─── WebChat ────────────────────────────────────────────────────────────

  async webChatMessage(req: any) {
    const slug = req.params?.slug
    const { sessionId, content } = req.body || {}
    if (!content) return { status: 400, body: { error: 'content es requerido' } }

    const hotels = await (this.service as any).hotelRepo.findMany({})
    const hotel = (hotels as any[]).find((h: any) =>
      h.name?.toLowerCase().replace(/\s+/g, '-') === slug || h.id === slug
    )
    if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }

    const conv = await this.service.findOrCreateConversation({
      hotelId: hotel.id,
      channel: 'webchat',
      channelConversationId: sessionId || crypto.randomUUID(),
      guestName: 'Web Guest',
      language: 'es',
    })

    const response = await this.service.processIncomingMessage(conv.id, content, hotel.id)
    return { status: 200, body: { conversationId: conv.id, response } }
  }

  // ─── Metrics ────────────────────────────────────────────────────────────

  async metrics(req: any) {
    const user = req.user || {}
    const period = (req.query?.period as string) || 'today'
    const result = await this.service.getMetrics(req.query?.hotelId || '', period as 'today' | 'week' | 'month', user)
    return { status: 200, body: { data: result } }
  }

  async dashboardMetrics(req: any) {
    const user = req.user || {}
    const result = await this.service.getDashboardMetrics(req.query?.hotelId || '', user)
    return { status: 200, body: result }
  }

  // ─── Baileys WhatsApp ──────────────────────────────────────────────────

  async startWhatsapp(req: any) {
    const user = req.user || {}
    const hotelId = req.body?.hotelId || user.hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const result = await this.service.startWhatsappSession(hotelId)
    return { status: 200, body: result }
  }

  async stopWhatsapp(req: any) {
    const user = req.user || {}
    const hotelId = req.body?.hotelId || user.hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const result = await this.service.stopWhatsappSession(hotelId)
    return { status: 200, body: result }
  }

  async getWhatsappQR(req: any) {
    const user = req.user || {}
    const hotelId = req.params?.hotelId || user.hotelId
    const result = await this.service.getWhatsappQR(hotelId)
    return { status: 200, body: result }
  }

  async getWhatsappStatus(req: any) {
    const user = req.user || {}
    const hotelId = req.params?.hotelId || user.hotelId
    const result = await this.service.getWhatsappStatus(hotelId)
    return { status: 200, body: result }
  }
}
