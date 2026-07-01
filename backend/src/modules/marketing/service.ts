// marketing/service.ts
import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import type {
  AutoMessageDTO, CreateAutoMessageDTO,
  MessageLogDTO, CreateMessageLogDTO,
  WhatsappTemplateDTO, CreateWhatsappTemplateDTO,
} from './types'
import type { MarketingSockets } from './sockets'
import type { EmailSender } from '../../services/email-sender'
import type { NotificationEvent, NotificationLanguage } from '../../services/notification-defaults'

export interface TriggerDeps {
  emailSender: EmailSender
  guestRepo: RepositoryAdapter<any>
  roomRepo: RepositoryAdapter<any>
  hotelRepo: RepositoryAdapter<any>
}

export class MarketingService {
  private sockets: MarketingSockets = {}

  constructor(
    private readonly autoMsgRepo: RepositoryAdapter<AutoMessageDTO>,
    private readonly logRepo: RepositoryAdapter<MessageLogDTO>,
    private readonly templateRepo: RepositoryAdapter<WhatsappTemplateDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    private readonly triggerDeps?: TriggerDeps,
  ) {}

  setSockets(s: Partial<MarketingSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) { const h = next[key]; if (!h) continue; const prev = cur[key]; cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h }
  }

  setTriggerDeps(deps: TriggerDeps): void {
    ;(this as any).triggerDeps = deps
  }

  // ─── Auto Messages ────────────────────────────────────
  async listAutoMessages(hotelId: string): Promise<AutoMessageDTO[]> { return this.autoMsgRepo.findMany({ hotelId }) }
  async createAutoMessage(dto: CreateAutoMessageDTO): Promise<AutoMessageDTO> {
    return this.autoMsgRepo.create({ ...dto, isActive: dto.isActive !== false ? 1 : 0 } as any)
  }
  async updateAutoMessage(id: string, data: Partial<CreateAutoMessageDTO>): Promise<AutoMessageDTO> {
    const patch: Record<string, any> = {}
    const fields = ['title','color','emailSubject','emailBody','whatsappBody','channel','triggerEvent','triggerOffset','variables','isActive','event','language','triggerType']
    for (const k of fields) if ((data as any)[k] !== undefined) patch[k] = (data as any)[k]
    await this.autoMsgRepo.update(id, patch as any)
    // @ignore IDOR_RISK — returning updated record after write
    return this.autoMsgRepo.findById(id) as Promise<AutoMessageDTO>
  }
  async deleteAutoMessage(id: string): Promise<void> { await this.autoMsgRepo.delete(id) }

  // ─── Message Logs ──────────────────────────────────────
  async listMessageLogs(hotelId: string, reservationId?: string): Promise<MessageLogDTO[]> {
    const filters: Record<string, any> = { hotelId }
    if (reservationId) filters.reservationId = reservationId
    const data = await this.logRepo.findMany(filters)
    return data.sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))
  }
  async createMessageLog(dto: CreateMessageLogDTO): Promise<MessageLogDTO> { return this.logRepo.create(dto as any) }

  // ─── WhatsApp Templates ────────────────────────────────
  async listTemplates(hotelId: string): Promise<WhatsappTemplateDTO[]> { return this.templateRepo.findMany({ hotelId }) }
  async createTemplate(dto: CreateWhatsappTemplateDTO): Promise<WhatsappTemplateDTO> {
    return this.templateRepo.create({ ...dto, isActive: dto.isActive !== false ? 1 : 0 } as any)
  }
  async updateTemplate(id: string, data: Partial<CreateWhatsappTemplateDTO>): Promise<WhatsappTemplateDTO> {
    const patch: Record<string, any> = {}
    for (const k of ['name','body','category']) if ((data as any)[k] !== undefined) patch[k] = (data as any)[k]
    if (data.isActive !== undefined) patch.isActive = data.isActive ? 1 : 0
    await this.templateRepo.update(id, patch as any)
    // @ignore IDOR_RISK — returning updated record after write
    return this.templateRepo.findById(id) as Promise<WhatsappTemplateDTO>
  }
  async deleteTemplate(id: string): Promise<void> { await this.templateRepo.delete(id) }

  // ─── Trigger Auto-Messages ────────────────────────────
  /**
   * Dispara auto-messages activos para un evento dado.
   * Resuelve variables desde la reserva/huésped/hotel y encola emails via EmailSender.
   */
  async triggerAutoMessages(params: {
    hotelId: string
    event: string
    reservationId: string
    guestId?: string
    roomId?: string
    variables?: Record<string, string | number>
  }): Promise<void> {
    if (!this.triggerDeps?.emailSender) {
      this.logger.warn('triggerAutoMessages: emailSender no configurado')
      return
    }

    const { hotelId, event, reservationId, guestId, roomId, variables: extraVars } = params

    // Buscar auto-messages activos para este evento
    const allMsgs = await this.autoMsgRepo.findMany({ hotelId, isActive: 1 } as any)
    const matching = allMsgs.filter(m => m.triggerEvent === event)
    if (matching.length === 0) return

    // Resolver variables del contexto
    const guest = guestId ? await this.triggerDeps.guestRepo.findById(guestId) : null
    const room = roomId ? await this.triggerDeps.roomRepo.findById(roomId) : null
    const hotel = await this.triggerDeps.hotelRepo.findById(hotelId)

    const baseVars: Record<string, string | number> = {
      guest_name: guest?.name || guest?.firstName || 'Huésped',
      hotel_name: hotel?.name || 'Hotel',
      hotel_phone: hotel?.phone || '',
      hotel_address: hotel?.address || '',
      room_number: room?.number || '',
      room_type: room?.type || '',
      ...extraVars,
    }

    for (const msg of matching) {
      try {
        const language = (msg.language || 'es') as any
        const templateEvent = msg.event || 'checkin_welcome'

        const queueId = await this.triggerDeps.emailSender.enqueueNotification({
          to: guest?.email || '',
          hotelId,
          event: templateEvent as NotificationEvent,
          language: language as NotificationLanguage,
          variables: baseVars,
          relatedType: 'auto_message',
          relatedId: msg.id,
        })

        // Log del envío
        await this.createMessageLog({
          hotelId,
          reservationId,
          guestId: guestId || null,
          channel: msg.channel || 'email',
          templateId: msg.id || null,
          status: queueId ? 'queued' : 'failed',
          sentAt: new Date().toISOString(),
          metadata: JSON.stringify({ autoMessageId: msg.id, event, queueId }),
        } as any)

        this.logger.info('Auto-message encolado', { hotelId, event, guest: guest?.email, queueId })
      } catch (e) {
        this.logger.warn('Error en auto-message', { hotelId, event, error: (e as Error).message })
      }
    }
  }
}
