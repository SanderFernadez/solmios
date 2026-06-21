// hoteles/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<HotelesDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { HotelesDTO, CreateHotelesDTO, UpdateHotelesDTO, HotelesQuery, HotelesPaginated } from './types'
import type { HotelesSockets } from './sockets'

export class HotelesService {
  private sockets: HotelesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<HotelesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<HotelesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: HotelesQuery): Promise<HotelesPaginated> {
    this.logger.info('Listando hoteles', { query })

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

  async getById(id: string): Promise<HotelesDTO> {
    this.logger.info('Obteniendo hoteles', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Hoteles no encontrado')
    // IDOR: si el recurso tiene userId u ownerId, descomentar y adaptar:
    // auth.assertOwnership(item.userId as string, currentUser.id, currentUser.role)
    return item
  }

  async create(dto: CreateHotelesDTO): Promise<HotelesDTO> {
    this.logger.info('Creando hoteles')
    const item = await this.repo.create(dto as Omit<HotelesDTO, 'id'>)
    await this.sockets.onHotelesCreated?.(item)
    await this.cache.delete('hoteles:list')
    return item
  }

  async update(id: string, dto: UpdateHotelesDTO): Promise<HotelesDTO> {
    this.logger.info('Actualizando hoteles', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<HotelesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Hoteles no encontrado')
    await this.sockets.onHotelesUpdated?.(item)
    await this.cache.delete('hoteles:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando hoteles', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Hoteles no encontrado')
    await this.sockets.onHotelesDeleted?.(id)
    await this.cache.delete('hoteles:list')
  }
}
