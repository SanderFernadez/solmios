// photo-requirements.ts — CRUD de requisitos de fotos por área/tipo habitación
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'

export interface PhotoRequirement {
  id: string
  areaId: string
  areaName: string
  icon: string
  required: boolean
  tipText: string
  roomType: string
  active: boolean
  hotelId: string
}

export class PhotoRequirementsUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<PhotoRequirement>,
    private readonly logger: Logger,
  ) {}

  async list(hotelId: string, roomType?: string): Promise<PhotoRequirement[]> {
    const filters: Record<string, unknown> = { hotelId, active: true }
    if (roomType) filters.roomType = roomType
    return this.repo.findMany(filters)
  }

  async upsert(hotelId: string, items: Partial<PhotoRequirement>[]): Promise<PhotoRequirement[]> {
    const results: PhotoRequirement[] = []
    for (const item of items) {
      const existing = await this.repo.findMany({
        hotelId,
        areaId: item.areaId,
        roomType: item.roomType || 'all',
      })
      if (existing.length > 0) {
        const updated = await this.repo.update(existing[0].id, item as any)
        if (updated) results.push(updated)
      } else {
        const created = await this.repo.create({
          ...item,
          hotelId,
          active: true,
        } as any)
        results.push(created)
      }
    }
    return results
  }
}
