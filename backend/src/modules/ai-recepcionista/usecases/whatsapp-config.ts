import type { AiWhatsappConfigDTO, CreateAiWhatsappConfigDTO } from '../types'

/** Reads the single WhatsApp config row for a hotel (one per hotel). */
export async function getWhatsappConfig(repo: any, hotelId: string): Promise<AiWhatsappConfigDTO | null> {
  const configs = await repo.findMany({ hotelId })
  return configs[0] || null
}

/** Upserts the WhatsApp config: updates the existing row or creates a new one with defaults. */
export async function updateWhatsappConfig(
  repo: any,
  hotelId: string,
  dto: CreateAiWhatsappConfigDTO,
): Promise<AiWhatsappConfigDTO> {
  const existing = (await repo.findMany({ hotelId }))[0]
  if (existing) {
    const updated = await repo.update(existing.id, { ...dto, isActive: 1 } as any)
    return updated!
  }
  return repo.create({
    id: crypto.randomUUID(), hotelId,
    phoneNumberId: dto.phoneNumberId, wabaId: dto.wabaId || null,
    accessToken: dto.accessToken, verifyToken: dto.verifyToken,
    webhookUrl: null, isActive: 1,
    businessHoursStart: dto.businessHoursStart || '08:00',
    businessHoursEnd: dto.businessHoursEnd || '22:00',
    businessDays: dto.businessDays || [1, 2, 3, 4, 5, 6, 7],
    outsideHoursMessage: dto.outsideHoursMessage || null,
    autoReplyDelay: dto.autoReplyDelay || 1000, maxAutoRetries: dto.maxAutoRetries || 3,
    transferAgentPhone: dto.transferAgentPhone || null,
    dailyMessageLimit: dto.dailyMessageLimit || 1000,
  } as any)
}
