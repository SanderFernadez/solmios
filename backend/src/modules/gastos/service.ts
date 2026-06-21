// gastos/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<GastosDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { GastosDTO, CreateGastosDTO, UpdateGastosDTO, GastosQuery, GastosPaginated, CurrentUser } from './types'
import type { GastosSockets } from './sockets'

export class GastosService {
  private sockets: GastosSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<GastosDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<GastosSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: GastosQuery): Promise<GastosPaginated> {
    this.logger.info('Listando gastos', { query })

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

  async getById(id: string, user: CurrentUser): Promise<GastosDTO> {
    this.logger.info('Obteniendo gastos', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Gastos no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async create(dto: CreateGastosDTO): Promise<GastosDTO> {
    this.logger.info('Creando gastos')
    const item = await this.repo.create(dto as Omit<GastosDTO, 'id'>)
    await this.sockets.onGastosCreated?.(item)
    await this.cache.delete('gastos:list')
    return item
  }

  async update(id: string, dto: UpdateGastosDTO, user: CurrentUser): Promise<GastosDTO> {
    this.logger.info('Actualizando gastos', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Gastos no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.repo.update(id, dto as Partial<Omit<GastosDTO, 'id'>>)
    if (!item) throw new NotFoundError('Gastos no encontrado')
    await this.sockets.onGastosUpdated?.(item)
    await this.cache.delete('gastos:list')
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    this.logger.info('Eliminando gastos', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Gastos no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Gastos no encontrado')
    await this.sockets.onGastosDeleted?.(id)
    await this.cache.delete('gastos:list')
  }
}
