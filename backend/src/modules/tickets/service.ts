// tickets/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<TicketsDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { TicketsDTO, CreateTicketsDTO, UpdateTicketsDTO, TicketsQuery, TicketsPaginated } from './types'
import type { TicketsSockets } from './sockets'

export class TicketsService {
  private sockets: TicketsSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<TicketsDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<TicketsSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: TicketsQuery): Promise<TicketsPaginated> {
    this.logger.info('Listando tickets', { query })

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

  async getById(id: string): Promise<TicketsDTO> {
    this.logger.info('Obteniendo tickets', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Tickets no encontrado')
    // IDOR: si el recurso tiene userId u ownerId, descomentar y adaptar:
    // auth.assertOwnership(item.userId as string, currentUser.id, currentUser.role)
    return item
  }

  async create(dto: CreateTicketsDTO): Promise<TicketsDTO> {
    this.logger.info('Creando tickets')
    const item = await this.repo.create(dto as Omit<TicketsDTO, 'id'>)
    await this.sockets.onTicketsCreated?.(item)
    await this.cache.delete('tickets:list')
    return item
  }

  async update(id: string, dto: UpdateTicketsDTO): Promise<TicketsDTO> {
    this.logger.info('Actualizando tickets', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<TicketsDTO, 'id'>>)
    if (!item) throw new NotFoundError('Tickets no encontrado')
    await this.sockets.onTicketsUpdated?.(item)
    await this.cache.delete('tickets:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando tickets', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Tickets no encontrado')
    await this.sockets.onTicketsDeleted?.(id)
    await this.cache.delete('tickets:list')
  }
}
