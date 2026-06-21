// notificaciones/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<NotificacionesDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { NotificacionesDTO, CreateNotificacionesDTO, UpdateNotificacionesDTO, NotificacionesQuery, NotificacionesPaginated } from './types'
import type { NotificacionesSockets } from './sockets'

export class NotificacionesService {
  private sockets: NotificacionesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<NotificacionesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<NotificacionesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: NotificacionesQuery): Promise<NotificacionesPaginated> {
    this.logger.info('Listando notificaciones', { query })

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

  async getById(id: string): Promise<NotificacionesDTO> {
    this.logger.info('Obteniendo notificaciones', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Notificaciones no encontrado')
    // IDOR: si el recurso tiene userId u ownerId, descomentar y adaptar:
    // auth.assertOwnership(item.userId as string, currentUser.id, currentUser.role)
    return item
  }

  async create(dto: CreateNotificacionesDTO): Promise<NotificacionesDTO> {
    this.logger.info('Creando notificaciones')
    const item = await this.repo.create(dto as Omit<NotificacionesDTO, 'id'>)
    await this.sockets.onNotificacionesCreated?.(item)
    await this.cache.delete('notificaciones:list')
    return item
  }

  async update(id: string, dto: UpdateNotificacionesDTO): Promise<NotificacionesDTO> {
    this.logger.info('Actualizando notificaciones', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<NotificacionesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Notificaciones no encontrado')
    await this.sockets.onNotificacionesUpdated?.(item)
    await this.cache.delete('notificaciones:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando notificaciones', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Notificaciones no encontrado')
    await this.sockets.onNotificacionesDeleted?.(id)
    await this.cache.delete('notificaciones:list')
  }
}
