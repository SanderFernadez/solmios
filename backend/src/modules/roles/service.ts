// roles/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<RolesDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { RolesDTO, CreateRolesDTO, UpdateRolesDTO, RolesQuery, RolesPaginated } from './types'
import type { RolesSockets } from './sockets'

export class RolesService {
  private sockets: RolesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<RolesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<RolesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: RolesQuery): Promise<RolesPaginated> {
    this.logger.info('Listando roles', { query })

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

  async getById(id: string): Promise<RolesDTO> {
    this.logger.info('Obteniendo roles', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Roles no encontrado')
    // IDOR: si el recurso tiene userId u ownerId, descomentar y adaptar:
    // auth.assertOwnership(item.userId as string, currentUser.id, currentUser.role)
    return item
  }

  async create(dto: CreateRolesDTO): Promise<RolesDTO> {
    this.logger.info('Creando roles')
    const item = await this.repo.create(dto as Omit<RolesDTO, 'id'>)
    await this.sockets.onRolesCreated?.(item)
    await this.cache.delete('roles:list')
    return item
  }

  async update(id: string, dto: UpdateRolesDTO): Promise<RolesDTO> {
    this.logger.info('Actualizando roles', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<RolesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Roles no encontrado')
    await this.sockets.onRolesUpdated?.(item)
    await this.cache.delete('roles:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando roles', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Roles no encontrado')
    await this.sockets.onRolesDeleted?.(id)
    await this.cache.delete('roles:list')
  }
}
