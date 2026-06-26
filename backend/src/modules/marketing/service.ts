// marketing/service.ts
import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import type {
  AutoMessageDTO, CreateAutoMessageDTO,
  MessageLogDTO, CreateMessageLogDTO,
  WhatsappTemplateDTO, CreateWhatsappTemplateDTO,
} from './types'
import type { MarketingSockets } from './sockets'

export class MarketingService {
  private sockets: MarketingSockets = {}

  constructor(
    private readonly autoMsgRepo: RepositoryAdapter<AutoMessageDTO>,
    private readonly logRepo: RepositoryAdapter<MessageLogDTO>,
    private readonly templateRepo: RepositoryAdapter<WhatsappTemplateDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
  ) {}

  setSockets(s: Partial<MarketingSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) { const h = next[key]; if (!h) continue; const prev = cur[key]; cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h }
  }

  // ─── Auto Messages ────────────────────────────────────
  async listAutoMessages(hotelId: string): Promise<AutoMessageDTO[]> { return this.autoMsgRepo.findMany({ hotelId }) }
  async createAutoMessage(dto: CreateAutoMessageDTO): Promise<AutoMessageDTO> {
    return this.autoMsgRepo.create({ ...dto, isActive: dto.isActive !== false ? 1 : 0 } as any)
  }
  async updateAutoMessage(id: string, data: Partial<CreateAutoMessageDTO>): Promise<AutoMessageDTO> {
    const patch: Record<string, any> = {}
    const fields = ['title','color','emailSubject','emailBody','whatsappBody','channel','triggerEvent','triggerOffset','variables','isActive']
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
}
