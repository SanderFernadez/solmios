// paquetes/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<PaquetesDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { PaquetesDTO, CreatePaquetesDTO, UpdatePaquetesDTO, PaquetesQuery, PaquetesPaginated, CurrentUser } from './types'
import type { PaquetesSockets } from './sockets'

export class PaquetesService {
  private sockets: PaquetesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<PaquetesDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<PaquetesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: PaquetesQuery, user?: CurrentUser): Promise<PaquetesPaginated> {
    this.logger.info('Listando paquetes', { query })

    const filters: Record<string, unknown> = {}

    if (user && user.role !== 'super_admin') {
      // hotelId llega en el JWT (HotelAuth). Sin findById: tokens legacy sin hotelId → '__none__' (lista vacía, sin fuga).
      filters.hotelId = user.hotelId ?? '__none__'
    } else if (query?.hotelId !== undefined) {
      filters.hotelId = query.hotelId
    }
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

  async getById(id: string, user: CurrentUser): Promise<PaquetesDTO> {
    this.logger.info('Obteniendo paquetes', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Paquetes no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async create(dto: CreatePaquetesDTO): Promise<PaquetesDTO> {
    this.logger.info('Creando paquetes')
    const item = await this.repo.create(dto as Omit<PaquetesDTO, 'id'>)
    await this.sockets.onPaquetesCreated?.(item)
    await this.cache.delete('paquetes:list')
    return item
  }

  async update(id: string, dto: UpdatePaquetesDTO, user: CurrentUser): Promise<PaquetesDTO> {
    this.logger.info('Actualizando paquetes', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Paquetes no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.repo.update(id, dto as Partial<Omit<PaquetesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Paquetes no encontrado')
    await this.sockets.onPaquetesUpdated?.(item)
    await this.cache.delete('paquetes:list')
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    this.logger.info('Eliminando paquetes', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Paquetes no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Paquetes no encontrado')
    await this.sockets.onPaquetesDeleted?.(id)
    await this.cache.delete('paquetes:list')
  }
}
