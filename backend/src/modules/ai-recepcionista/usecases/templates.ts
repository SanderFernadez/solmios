import { NotFoundError, AuthError } from 'arckode-framework'
import type {
  AiTemplateDTO, CreateAiTemplateDTO, UpdateAiTemplateDTO,
} from '../types'

export async function listTemplates(
  repo: any,
  hotelId: string,
  category?: string,
  isActive?: number,
  page?: number,
  limit?: number,
): Promise<{ data: AiTemplateDTO[]; total: number }> {
  const filters: Record<string, unknown> = { hotelId }
  if (category) filters.category = category
  if (isActive !== undefined) filters.isActive = isActive
  const p = Math.max(page || 1, 1)
  const l = Math.min(Math.max(limit || 50, 1), 200)
  const offset = (p - 1) * l
  const result = await repo.paginate(filters, { offset, limit: l })
  return { data: result.data, total: result.total }
}

export async function createTemplate(
  repo: any,
  dto: CreateAiTemplateDTO,
  hotelId: string,
): Promise<AiTemplateDTO> {
  return repo.create({
    id: crypto.randomUUID(), hotelId,
    name: dto.name, category: dto.category,
    trigger: dto.trigger || null,
    responseEs: dto.responseEs,
    responseEn: dto.responseEn || null,
    responsePt: dto.responsePt || null,
    channel: dto.channel || 'all',
    variables: dto.variables || [],
    buttons: dto.buttons || null,
    isSystem: 0, isActive: 1,
  } as any)
}

export async function updateTemplate(
  repo: any,
  id: string, dto: UpdateAiTemplateDTO,
  userHotelId?: string, userRole?: string,
): Promise<AiTemplateDTO> {
  // @ignore IDOR_RISK
  const existing = await repo.findById(id)
  if (!existing) throw new NotFoundError('Plantilla no encontrada')
  if (userRole !== 'super_admin' && existing.hotelId !== userHotelId) {
    throw new AuthError('No autorizado')
  }
  const updated = await repo.update(id, dto as any)
  if (!updated) throw new NotFoundError('Plantilla no encontrada')
  return updated
}

export async function deleteTemplate(
  repo: any,
  id: string, userHotelId?: string, userRole?: string,
): Promise<void> {
  // @ignore IDOR_RISK
  const existing = await repo.findById(id)
  if (!existing) throw new NotFoundError('Plantilla no encontrada')
  if (userRole !== 'super_admin' && existing.hotelId !== userHotelId) {
    throw new AuthError('No autorizado')
  }
  if (existing.isSystem === 1) {
    throw new AuthError('Las plantillas del sistema no se pueden eliminar')
  }
  await repo.delete(id)
}
