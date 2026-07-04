// config-lists.ts — Usecase: Photo Requirements y Supply Lists
import type { RepositoryAdapter, Logger } from 'arckode-framework'

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

export interface SupplyItem {
  id: string
  roomType: string
  name: string
  quantity: number
  unit: string
  hotelId: string
}

export class ConfigListsUseCase {
  constructor(
    private readonly photoReqRepo: RepositoryAdapter<PhotoRequirement>,
    private readonly supplyRepo: RepositoryAdapter<SupplyItem>,
    private readonly logger: Logger,
  ) {}

  // ─── Photo Requirements ───────────────────────────────────────────────────
  async getPhotoRequirements(hotelId: string, roomType?: string): Promise<PhotoRequirement[]> {
    const filters: Record<string, unknown> = { hotelId, active: true }
    if (roomType) filters.roomType = roomType
    return this.photoReqRepo.findMany(filters)
  }

  async upsertPhotoRequirements(hotelId: string, items: Partial<PhotoRequirement>[]): Promise<PhotoRequirement[]> {
    const results: PhotoRequirement[] = []
    for (const item of items) {
      const existing = await this.photoReqRepo.findMany({
        hotelId,
        areaId: item.areaId,
        roomType: item.roomType || 'all',
      })
      if (existing.length > 0) {
        const updated = await this.photoReqRepo.update(existing[0].id, item as any)
        if (updated) results.push(updated)
      } else {
        const created = await this.photoReqRepo.create({ ...item, hotelId, active: true } as any)
        results.push(created)
      }
    }
    return results
  }

  // ─── Supply Lists ─────────────────────────────────────────────────────────
  async getSupplyLists(hotelId: string, roomType?: string): Promise<SupplyItem[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (roomType) filters.roomType = roomType
    return this.supplyRepo.findMany(filters)
  }

  async upsertSupplyLists(hotelId: string, roomType: string, items: Partial<SupplyItem>[]): Promise<SupplyItem[]> {
    const existing = await this.supplyRepo.findMany({ hotelId, roomType })
    for (const item of existing) {
      await this.supplyRepo.delete(item.id)
    }
    const results: SupplyItem[] = []
    for (const item of items) {
      const created = await this.supplyRepo.create({ ...item, hotelId, roomType } as any)
      results.push(created)
    }
    return results
  }
}
