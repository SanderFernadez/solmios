// canales/usecases/config.ts — Config management for channel manager
import type { RepositoryAdapter } from 'arckode-framework'
import type { CanalesDTO } from '../types'
import type { CanalesQueries } from './canales-queries'

export class ConfigUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<CanalesDTO>,
    private readonly queries: CanalesQueries,
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
    return this.queries.getOTACatalog()
  }
}
