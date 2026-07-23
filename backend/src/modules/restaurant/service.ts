// restaurant/service.ts — Facade del módulo POS de restaurante. Orquesta; la lógica que crece va a
// usecases/. Depende de RepositoryAdapter, NO del ORM directo. NO importa de otros módulos (eso va por
// conectores). RES-0: CRUD de estaciones (pantallas KDS configurables). Sprints siguientes agregan
// carta, mesas, comandas, KDS y cobro. Ver openspec/changes/restaurante-pos.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { StationDTO, CurrentUser } from './types'
import type { RestaurantSockets } from './sockets'

export class RestaurantService {
  private sockets: RestaurantSockets = {}

  constructor(
    private readonly stations: RepositoryAdapter<StationDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth: Auth,
  ) {}

  // Acumula handlers, nunca pisa el anterior (composición de sockets).
  setSockets(s: Partial<RestaurantSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  /** hotelId SIEMPRE del JWT (nunca del body) — anti-IDOR multi-tenant. */
  private hotelFor(user: CurrentUser): string {
    const h = user.hotelId || ''
    if (!h) throw new ValidationError('Sin hotel asignado')
    return h
  }

  // ─── Estaciones (RES-0) — pantallas KDS configurables por hotel ───
  async listStations(user: CurrentUser): Promise<{ data: StationDTO[]; total: number }> {
    const data = await this.stations.findMany({ hotelId: this.hotelFor(user) })
    data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    return { data, total: data.length }
  }

  async getStation(id: string, user: CurrentUser): Promise<StationDTO> {
    const item = await this.stations.findById(id)
    if (!item) throw new NotFoundError('Estación no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async createStation(dto: { name: string; active?: number; sortOrder?: number }, user: CurrentUser): Promise<StationDTO> {
    const hotelId = this.hotelFor(user)
    if (!dto.name?.trim()) throw new ValidationError('El nombre de la estación es obligatorio')
    return this.stations.create({
      hotelId,
      name: dto.name.trim(),
      active: dto.active ?? 1,
      sortOrder: dto.sortOrder ?? 0,
    } as Omit<StationDTO, 'id'>)
  }

  async updateStation(id: string, dto: { name?: string; active?: number; sortOrder?: number }, user: CurrentUser): Promise<StationDTO> {
    const existing = await this.stations.findById(id)
    if (!existing) throw new NotFoundError('Estación no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.stations.update(id, dto as Partial<Omit<StationDTO, 'id'>>)
    if (!item) throw new NotFoundError('Estación no encontrada')
    return item
  }

  async deleteStation(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.stations.findById(id)
    if (!existing) throw new NotFoundError('Estación no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    // No hay integridad dura: las categorías/ítems que la referencian caen al fallback de ruteo
    // (1ª estación activa / "Sin estación"), y las líneas ya emitidas guardan stationName snapshot.
    const deleted = await this.stations.delete(id)
    if (!deleted) throw new NotFoundError('Estación no encontrada')
  }
}
