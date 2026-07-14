// huespedes/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<HuespedesDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ConflictError, ValidationError } from 'arckode-framework'
import type { HuespedesDTO, CreateHuespedesDTO, UpdateHuespedesDTO, HuespedesQuery, HuespedesPaginated, CurrentUser } from './types'
import type { HuespedesSockets } from './sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

export class HuespedesService {
  private sockets: HuespedesSockets = {}
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `huespedes-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  constructor(
    private readonly repo: RepositoryAdapter<HuespedesDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<HuespedesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // Email: formato RFC-ish práctico. Vacío/ausente = válido (email opcional en el schema).
  private static readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  private validateEmailFormat(email: string | undefined): void {
    const value = email?.trim()
    if (value && !HuespedesService.EMAIL_RE.test(value)) {
      throw new ValidationError('El email no tiene un formato válido')
    }
  }

  // Unicidad por hotel: email y document no pueden repetirse dentro del mismo hotel.
  // Vacío/ausente se omite (permite varios huéspedes sin email/documento). excludeId para update.
  private async assertUniqueField(field: 'email' | 'document', value: string | undefined, hotelId: string, excludeId?: string): Promise<void> {
    const v = value?.trim()
    if (!v) return
    const dup = await this.repo.findOne({ [field]: v, hotelId } as Record<string, unknown>)
    if (dup && dup.id !== excludeId) {
      const label = field === 'email' ? 'email' : 'documento'
      throw new ConflictError(`Ya existe un huésped con ese ${label} en este hotel`)
    }
  }

  async list(query?: HuespedesQuery, user?: CurrentUser): Promise<HuespedesPaginated> {
    this.logger.info('Listando huespedes', { query })

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

  async getById(id: string, user: CurrentUser): Promise<HuespedesDTO> {
    this.logger.info('Obteniendo huespedes', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Huespedes no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async create(dto: CreateHuespedesDTO): Promise<HuespedesDTO> {
    this.logger.info('Creando huespedes')
    this.validateEmailFormat(dto.email)
    await this.assertUniqueField('email', dto.email, dto.hotelId)
    await this.assertUniqueField('document', dto.document, dto.hotelId)
    const item = await this.repo.create(dto as Omit<HuespedesDTO, 'id'>)
    await this.sockets.onHuespedesCreated?.(item)
    await this.cache.delete('huespedes:list')
    return item
  }

  async update(id: string, dto: UpdateHuespedesDTO, user: CurrentUser): Promise<HuespedesDTO> {
    this.logger.info('Actualizando huespedes', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Huespedes no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    // Unicidad: si cambian email/document, que no colisionen con otro huésped del mismo hotel.
    this.validateEmailFormat(dto.email)
    const hotelId = (dto.hotelId ?? existing.hotelId) as string
    await this.assertUniqueField('email', dto.email, hotelId, id)
    await this.assertUniqueField('document', dto.document, hotelId, id)
    const item = await this.repo.update(id, dto as Partial<Omit<HuespedesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Huespedes no encontrado')
    await this.sockets.onHuespedesUpdated?.(item)
    await this.cache.delete('huespedes:list')
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    this.logger.info('Eliminando huespedes', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Huespedes no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Huespedes no encontrado')
    await this.sockets.onHuespedesDeleted?.(id)
    await this.cache.delete('huespedes:list')
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: user.id, action: 'guest.delete',
      entity: 'guest', entityId: id,
      detail: `Huésped "${existing.name}"${existing.document ? ` (doc ${existing.document})` : ''} eliminado`,
    })
  }
}
