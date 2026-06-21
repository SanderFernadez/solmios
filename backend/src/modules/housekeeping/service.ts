// housekeeping/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<HousekeepingDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated } from './types'
import type { HousekeepingSockets } from './sockets'

export class HousekeepingService {
  private sockets: HousekeepingSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<HousekeepingSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev
        ? async (...a: any[]) => {
            try { await prev(...a) } catch (e) { this.logger.error(`Socket chain error [${key}]`, e as any) }
            await h(...a)
          }
        : h
    }
  }

  async list(query?: HousekeepingQuery): Promise<HousekeepingPaginated> {
    this.logger.info('Listando housekeeping', { query })

    const page = Math.max(1, Math.floor(Number(query?.page) || 1))
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query?.limit) || 20)))
    const offset = (page - 1) * limit
    const filters: Record<string, unknown> = {}

    if (query?.hotelId !== undefined) filters.hotelId = query.hotelId
    if (query?.status !== undefined) filters.status = query.status
    if (query?.type !== undefined) filters.type = query.type
    if (query?.category !== undefined) filters.category = query.category

    const rows = await this.repo.findMany(filters)
    let data = rows
    if (query?.search) {
      const q = String(query.search).toLowerCase()
      data = rows.filter((r: any) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)))
    }

    return { data, total: data.length }
  }

  async getById(id: string): Promise<HousekeepingDTO> {
    this.logger.info('Obteniendo housekeeping', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Housekeeping no encontrado')
    // IDOR: si el recurso tiene userId u ownerId, descomentar y adaptar:
    // auth.assertOwnership(item.userId as string, currentUser.id, currentUser.role)
    return item
  }

  async create(dto: CreateHousekeepingDTO): Promise<HousekeepingDTO> {
    this.logger.info('Creando housekeeping')
    const item = await this.repo.create(dto as Omit<HousekeepingDTO, 'id'>)
    await this.sockets.onHousekeepingCreated?.(item)
    await this.cache.delete('housekeeping:list')
    return item
  }

  async update(id: string, dto: UpdateHousekeepingDTO): Promise<HousekeepingDTO> {
    this.logger.info('Actualizando housekeeping', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<HousekeepingDTO, 'id'>>)
    if (!item) throw new NotFoundError('Housekeeping no encontrado')
    await this.sockets.onHousekeepingUpdated?.(item)
    await this.cache.delete('housekeeping:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando housekeeping', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Housekeeping no encontrado')
    await this.sockets.onHousekeepingDeleted?.(id)
    await this.cache.delete('housekeeping:list')
  }
}
