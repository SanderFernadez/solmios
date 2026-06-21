// apikeys/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<ApikeysDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { ApikeysDTO, CreateApikeysDTO, UpdateApikeysDTO, ApikeysQuery, ApikeysPaginated } from './types'
import type { ApikeysSockets } from './sockets'

export class ApikeysService {
  private sockets: ApikeysSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<ApikeysDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<ApikeysSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: ApikeysQuery): Promise<ApikeysPaginated> {
    this.logger.info('Listando apikeys', { query })

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

  async getById(id: string): Promise<ApikeysDTO> {
    this.logger.info('Obteniendo apikeys', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Apikeys no encontrado')
    // IDOR: si el recurso tiene userId u ownerId, descomentar y adaptar:
    // auth.assertOwnership(item.userId as string, currentUser.id, currentUser.role)
    return item
  }

  async create(dto: CreateApikeysDTO): Promise<ApikeysDTO> {
    this.logger.info('Creando apikeys')
    const item = await this.repo.create(dto as Omit<ApikeysDTO, 'id'>)
    await this.sockets.onApikeysCreated?.(item)
    await this.cache.delete('apikeys:list')
    return item
  }

  async update(id: string, dto: UpdateApikeysDTO): Promise<ApikeysDTO> {
    this.logger.info('Actualizando apikeys', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<ApikeysDTO, 'id'>>)
    if (!item) throw new NotFoundError('Apikeys no encontrado')
    await this.sockets.onApikeysUpdated?.(item)
    await this.cache.delete('apikeys:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando apikeys', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Apikeys no encontrado')
    await this.sockets.onApikeysDeleted?.(id)
    await this.cache.delete('apikeys:list')
  }
}
