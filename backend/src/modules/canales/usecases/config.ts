// canales/usecases/config.ts — Config management for channel manager
import type { RepositoryAdapter, ORM } from 'arckode-framework'
import type { CanalesDTO } from '../types'

export class ConfigUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<CanalesDTO>,
    private readonly orm?: ORM,
  ) {}

  async getConfig(hotelId: string): Promise<CanalesDTO | undefined> {
    const cfg = await this.repo.findOne({ hotelId } as any)
    return cfg ?? undefined
  }

  async upsertConfig(hotelId: string, patch: Partial<CanalesDTO>): Promise<CanalesDTO> {
    const cfg = await this.getConfig(hotelId)
    if (!cfg) return (await this.repo.create({ id: crypto.randomUUID(), hotelId, syncEnabled: 1, ...patch } as any))!
    return (await this.repo.update(cfg.id, patch as any))!
  }

  async getOTACatalog(): Promise<any[]> {
    try {
      if (!this.orm) return []
      const rows = await this.orm.findMany('Configuration', { hotelId: 'platform', clave: 'canales_ota' })
      const cfg = (rows as any[])?.[0]
      if (!cfg) return []
      const val = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value
      return Array.isArray(val) ? val : []
    } catch { return [] }
  }
}
