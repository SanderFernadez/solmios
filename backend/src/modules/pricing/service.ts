import { AuthError } from 'arckode-framework'
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { PricingQueries } from './usecases/pricing-queries'
import {
  auditSafely, rateChangeEntry, rateCopyEntry, seasonsChangeEntry,
  restrictionsChangeEntry, blockDeleteEntry,
  type AuditEntry, type AuditPort, type Actor, type RateChange,
} from './usecases/audit'

export class PricingService {
  private auditPort: AuditPort | null = null

  constructor(
    private readonly seasonsRepo: RepositoryAdapter<any>,
    private readonly ratesRepo: RepositoryAdapter<any>,
    private readonly blocksRepo: RepositoryAdapter<any>,
    private readonly restrictionsRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly queries?: PricingQueries,
  ) {}

  /** Conecta el audit log. Lo inyecta el connector `pricing-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  private audit(entry: AuditEntry): Promise<void> {
    return auditSafely(this.auditPort, this.logger, entry)
  }

  /** Temporadas por defecto (rangos del año en curso) — se siembran la 1ª vez que un hotel abre la sección. */
  private defaultSeasons(): any[] {
    const y = new Date().getFullYear()
    return [
      { name: 'baja', label: 'Temporada Baja', startDate: `${y}-01-01`, endDate: `${y}-05-31`, color: '#3b82f6', sortOrder: 0, active: 1 },
      { name: 'media', label: 'Temporada Media', startDate: `${y}-06-01`, endDate: `${y}-11-30`, color: '#14b8a6', sortOrder: 1, active: 0 },
      { name: 'alta', label: 'Temporada Alta', startDate: `${y}-12-01`, endDate: `${y}-12-31`, color: '#84cc16', sortOrder: 2, active: 0 },
      { name: 'especial', label: 'Temporada Especial', startDate: '', endDate: '', color: '#f59e0b', sortOrder: 3, active: 0 },
    ]
  }

  async listSeasons(hotelId: string): Promise<any[]> {
    let data = await this.seasonsRepo.findMany({ hotelId }) as any[]
    // Seed la 1ª vez: sin esto la temporada activa no tendría sobre qué operar.
    if (data.length === 0) {
      for (const s of this.defaultSeasons()) {
        await this.seasonsRepo.create({ id: crypto.randomUUID(), hotelId, ...s })
      }
      data = await this.seasonsRepo.findMany({ hotelId }) as any[]
    }
    return data.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }

  async updateSeasons(hotelId: string, seasons: any[], actor?: Actor): Promise<number> {
    const existing = await this.seasonsRepo.findMany({ hotelId }) as any[]
    for (const ex of existing) await this.seasonsRepo.delete(ex.id)
    // A lo sumo una activa: la 1ª marcada active en el payload; si ninguna, la primera.
    let activeIdx = seasons.findIndex((s) => s?.active)
    if (activeIdx === -1 && seasons.length > 0) activeIdx = 0
    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i]
      await this.seasonsRepo.create({
        id: crypto.randomUUID(), hotelId, name: s.name || `season-${i}`, label: s.label || '',
        startDate: s.startDate || '', endDate: s.endDate || '',
        color: s.color || '#3b82f6', sortOrder: i, active: i === activeIdx ? 1 : 0,
      })
    }
    await this.audit(seasonsChangeEntry(hotelId, seasons.length, actor))
    return seasons.length
  }

  /** Cambia la temporada activa del hotel (por nombre). Solo una queda activa. #148 */
  async activateSeason(hotelId: string, name: string, actor?: Actor): Promise<any[]> {
    const seasons = await this.listSeasons(hotelId) // garantiza que haya data seedeada
    const target = seasons.find((s) => s.name === name)
    if (!target) throw new AuthError(`Temporada '${name}' no existe en este hotel`)
    for (const s of seasons) {
      const shouldBeActive = s.name === name ? 1 : 0
      if ((s.active ? 1 : 0) !== shouldBeActive) {
        await this.seasonsRepo.update(s.id, { active: shouldBeActive })
      }
    }
    await this.audit(seasonsChangeEntry(hotelId, seasons.length, actor))
    return this.listSeasons(hotelId)
  }

  /** Modo de tarificación del hotel (per_room | per_person) — config PMS por cliente. */
  async getPricingMode(hotelId: string): Promise<'per_room' | 'per_person'> {
    return this.queries ? this.queries.getPricingMode(hotelId) : 'per_room'
  }
  async setPricingMode(hotelId: string, mode: string): Promise<'per_room' | 'per_person'> {
    const m = mode === 'per_person' ? 'per_person' : 'per_room'
    return this.queries ? this.queries.setPricingMode(hotelId, m) : m
  }

  async listRates(hotelId: string, channel?: string): Promise<any[]> {
    const all = await this.ratesRepo.findMany({ hotelId }) as any[]
    if (!channel) return all.filter((r) => !r.channel)
    // Vista por canal: delegada a queries, que arma la grilla (base o derivada de los room types) y
    // aplica overrides del canal. Fallback defensivo a solo-base si no hay queries inyectadas.
    if (this.queries) return this.queries.listChannelRates(hotelId, channel, all)
    return all.filter((r) => r.channel === channel)
  }

  async updateRates(hotelId: string, rates: any[], actor?: Actor): Promise<number> {
    let saved = 0
    const changes: RateChange[] = []
    for (const r of rates) {
      if (!r.roomType || !r.season || r.occupancy === undefined) continue
      const channel = typeof r.channel === 'string' ? r.channel : ''
      const basePrice = r.basePrice ?? 0; const percentage = r.percentage ?? 0
      const price = Math.round(basePrice * (1 + percentage / 100) * 100) / 100
      const closed = r.closed ? 1 : 0
      const minStay = Number(r.minStay) || 0; const maxStay = Number(r.maxStay) || 0
      const existing = (await this.ratesRepo.findMany({ hotelId, roomType: r.roomType, occupancy: r.occupancy, season: r.season, channel }))[0] as any
      const change: RateChange = { roomType: r.roomType, season: r.season, occupancy: r.occupancy, from: null, to: price, closed }
      if (existing) {
        await this.ratesRepo.update(existing.id, { basePrice, percentage, price, closed, minStay, maxStay })
        // El grid manda TODAS las celdas en cada guardado: solo se audita lo que realmente cambió.
        const moved = Number(existing.price ?? 0) !== price || Number(existing.closed ?? 0) !== closed
        if (moved) changes.push({ ...change, from: Number(existing.price ?? 0) })
      } else {
        await this.ratesRepo.create({ id: crypto.randomUUID(), hotelId, roomType: r.roomType, occupancy: r.occupancy, season: r.season, channel, basePrice, percentage, price, closed, minStay, maxStay })
        changes.push(change)
      }
      saved++
    }
    if (changes.length > 0) await this.audit(rateChangeEntry(hotelId, changes, actor))
    return saved
  }

  async copyRatesNextYear(hotelId: string, actor?: Actor): Promise<{ copied: number; total: number }> {
    const rates = await this.ratesRepo.findMany({ hotelId }) as any[]
    let copied = 0
    for (const r of rates) {
      const nextYear = String(r.season || '').replace(/\d{4}/, String(new Date().getFullYear() + 1))
      const exists = (await this.ratesRepo.findMany({ hotelId, roomType: r.roomType, occupancy: r.occupancy, season: nextYear }))[0]
      if (!exists) { await this.ratesRepo.create({ id: crypto.randomUUID(), hotelId, roomType: r.roomType, occupancy: r.occupancy, season: nextYear, price: r.price, basePrice: r.basePrice, percentage: r.percentage }); copied++ }
    }
    if (copied > 0) await this.audit(rateCopyEntry(hotelId, copied, rates.length, actor))
    return { copied, total: rates.length }
  }

  async listBlocks(hotelId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let data = await this.blocksRepo.findMany({ hotelId }) as any[]
    if (startDate && endDate) data = data.filter((b: any) => b.startDate <= endDate && b.endDate >= startDate)
    return data
  }

  async createBlocks(hotelId: string, userId: string, roomIds: string[], reason: string, startDate: string, endDate: string): Promise<any[]> {
    const created: any[] = []
    for (const roomId of roomIds) {
      created.push(await this.blocksRepo.create({ id: crypto.randomUUID(), hotelId, roomId, reason: reason || '', startDate, endDate, createdBy: userId }))
    }
    return created
  }

  async deleteBlock(id: string, hotelId: string, actor?: Actor): Promise<void> {
    // Seguridad (IDOR): solo se borra un bloqueo del hotel del token. Sin este check, cualquier
    // usuario con settings:delete borraba bloqueos de otro hotel pasando su id.
    const block = await this.blocksRepo.findById(id) as any
    if (!block) return
    if (block.hotelId !== hotelId) throw new AuthError('Sin acceso a este bloqueo')
    await this.blocksRepo.delete(id)
    await this.audit(blockDeleteEntry(block, actor))
  }

  async listRateRestrictions(hotelId: string): Promise<any[]> {
    return await this.restrictionsRepo.findMany({ hotelId }) as any[]
  }

  async updateRateRestrictions(hotelId: string, restrictions: any[], actor?: Actor): Promise<number> {
    let saved = 0
    for (const r of restrictions) {
      if (!r.roomType || !r.season) continue
      const existing = (await this.restrictionsRepo.findMany({ hotelId, roomType: r.roomType, season: r.season }))[0] as any
      if (existing) {
        await this.restrictionsRepo.update(existing.id, { minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cta: r.cta ?? 0, ctd: r.ctd ?? 0, closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0 })
      } else {
        await this.restrictionsRepo.create({ id: crypto.randomUUID(), hotelId, roomType: r.roomType, season: r.season, minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cta: r.cta ?? 0, ctd: r.ctd ?? 0, closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0 })
      }
      saved++
    }
    if (saved > 0) await this.audit(restrictionsChangeEntry(hotelId, saved, actor))
    return saved
  }

  async getChannelMetrics(hotelId: string): Promise<any[]> {
    if (!this.queries) throw new Error('Queries no disponible')
    return this.queries.getChannelMetrics(hotelId)
  }
}
