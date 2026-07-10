import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { NotificacionesDTO, CreateNotificacionesDTO, UpdateNotificacionesDTO, NotificacionesQuery, NotificacionesPaginated } from './types'
import type { NotificacionesSockets } from './sockets'

const CACHE_TTL = 300

export class NotificacionesService {
  private sockets: NotificacionesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<NotificacionesDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

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

  async list(query: NotificacionesQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<NotificacionesPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.type) filters.type = query.type
    if (query.channel) filters.channel = query.channel
    if (query.userId) filters.userId = query.userId
    if (query.read !== undefined) filters.read = query.read

    // Resolve hotelId from DB if not provided in token
    let hotelId = currentUser.hotelId
    if (!hotelId && currentUser.role !== 'super_admin') {
      const user = await this.userRepo.findById(currentUser.id)
      hotelId = user?.hotelId
    }

    if (currentUser.role !== 'super_admin') {
      if (!hotelId) throw new AuthError('No hotel assigned')
      filters.hotelId = hotelId
    } else if (query.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    // Cada usuario ve los avisos del hotel (broadcast, sin `userId`) MÁS los suyos
    // personales — nunca los de otro. El filtro del ORM es por igualdad y esto es
    // un OR (`userId` nulo O `userId` = yo), así que se resuelve en memoria: el
    // volumen de notificaciones por hotel es acotado. Un `?userId=` explícito
    // (un manager mirando a alguien) respeta ese pedido.
    const scoped = query.userId
      ? () => true
      : (n: NotificacionesDTO) => !n.userId || n.userId === currentUser.id

    // Sin cache: la key vieja era solo el hotel, así que la primera consulta se
    // cacheaba y todas las demás —de cualquier usuario— recibían ESA, y el aviso
    // personal no llegaba a su dueño. Con keys por usuario el `cache.delete` del
    // create no las alcanza (no hay glob). Es bajo volumen; se computa fresco.
    const all = (await this.repo.findMany(filters)).filter(scoped)
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const data = all.slice(offset, offset + limit)
    return { data, total: all.length, page, limit, pages: Math.ceil(all.length / limit) }
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<NotificacionesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Notificación no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  async create(dto: CreateNotificacionesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<NotificacionesDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    const item = await this.repo.create(dto as any)
    await this.sockets.onNotificacionesCreated?.(item)
    await this.cache.delete(`notificaciones:list:${dto.hotelId}`)
    return item
  }

  async update(id: string, dto: UpdateNotificacionesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<NotificacionesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Notificación no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Notificación no encontrada')
    await this.sockets.onNotificacionesUpdated?.(item)
    await this.cache.delete(`notificaciones:list:${existing.hotelId}`)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Notificación no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Notificación no encontrada')
    await this.sockets.onNotificacionesDeleted?.(id)
    await this.cache.delete(`notificaciones:list:${existing.hotelId}`)
  }
}
