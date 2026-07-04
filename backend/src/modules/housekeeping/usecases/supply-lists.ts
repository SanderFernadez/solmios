// supply-lists.ts — CRUD de listas de suministros por tipo de habitación
import type { RepositoryAdapter, Logger } from 'arckode-framework'

export interface SupplyItem {
  id: string
  roomType: string
  name: string
  quantity: number
  unit: string
  hotelId: string
}

export class SupplyListsUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<SupplyItem>,
    private readonly logger: Logger,
  ) {}

  async list(hotelId: string, roomType?: string): Promise<SupplyItem[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (roomType) filters.roomType = roomType
    return this.repo.findMany(filters)
  }

  async upsert(hotelId: string, roomType: string, items: Partial<SupplyItem>[]): Promise<SupplyItem[]> {
    // Eliminar existentes para este roomType
    const existing = await this.repo.findMany({ hotelId, roomType })
    for (const item of existing) {
      await this.repo.delete(item.id)
    }

    // Crear nuevos
    const results: SupplyItem[] = []
    for (const item of items) {
      const created = await this.repo.create({
        ...item,
        hotelId,
        roomType,
      } as any)
      results.push(created)
    }
    return results
  }
}
