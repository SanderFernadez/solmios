// canales/usecases/crud.ts — CRUD operations for channel config
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { CanalesDTO, CreateCanalesDTO, UpdateCanalesDTO, CanalesQuery, CanalesPaginated } from '../types'

/**
 * Enmascara la API key de Channex por-hotel antes de devolverla al cliente. GET /api/canales[/:id]
 * la exponía cruda (#394): un merchant —o cualquiera que interceptara la respuesta— podía leer la
 * credencial completa. Mismo criterio que la key de plataforma (service-channex-admin.maskKey).
 * El uso interno de la key NO pasa por acá: va por service.getConfig, que devuelve el DTO crudo.
 */
function maskChannexKey(item: CanalesDTO): CanalesDTO {
  const k = item.channexApiKey
  if (!k) return item
  return { ...item, channexApiKey: k.length <= 8 ? '••••' : `${k.slice(0, 4)}••••${k.slice(-4)}` }
}

export class CanalesCrudUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<CanalesDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  async list(query?: CanalesQuery, user?: { id: string; role?: string; hotelId?: string }): Promise<CanalesPaginated> {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit
    const filters: Record<string, unknown> = {}
    if (user && user.role !== 'super_admin') {
      filters.hotelId = user.hotelId ?? '__none__'
    } else if (query?.hotelId !== undefined) {
      filters.hotelId = query.hotelId
    }
    const result = await this.repo.paginate(filters, { limit, offset })
    return { data: result.data.map(maskChannexKey), pagination: { page, limit, total: result.total, totalPages: result.pages, hasNext: offset + limit < result.total, hasPrev: page > 1 } }
  }

  async getById(id: string, user: { id: string; role?: string; hotelId?: string }): Promise<CanalesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Canales no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return maskChannexKey(item)
  }

  async create(dto: CreateCanalesDTO): Promise<CanalesDTO> {
    return (await this.repo.create(dto as Omit<CanalesDTO, 'id'>))!
  }

  async update(id: string, dto: UpdateCanalesDTO, user: { id: string; role?: string; hotelId?: string }): Promise<CanalesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Canales no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.repo.update(id, dto as Partial<Omit<CanalesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Canales no encontrado')
    return item
  }

  /** Devuelve la config borrada: el service la necesita para auditar QUÉ conexión se cortó. */
  async delete(id: string, user: { id: string; role?: string; hotelId?: string }): Promise<CanalesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Canales no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Canales no encontrado')
    return existing
  }
}
