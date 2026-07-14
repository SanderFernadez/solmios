// activos/service.ts — Facade del módulo de activos (bienes asignados a empleados).
// Multi-tenant: TODA operación scopea por hotelId. El ownership se garantiza consultando
// por { id, hotelId } juntos (findOne), sin lookup por id suelto → sin IDOR por construcción.

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { ActivosDTO, CreateActivosDTO, UpdateActivosDTO, ActivosQuery, ActivosSummary } from './types'
import type { ActivosSockets } from './sockets'
import { accumulateSockets } from '../../shared/utils/accumulate-sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

export class ActivosService {
  private sockets: ActivosSockets = {}
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `activos-auditlog`. */
  setAuditDeps(port: AuditPort): void { this.auditPort = port }

  constructor(
    private readonly repo: RepositoryAdapter<ActivosDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly profileRepo?: RepositoryAdapter<{ id: string; hotelId: string }>,
  ) {}

  setSockets(s: Partial<ActivosSockets>): void { accumulateSockets(this.sockets as any, s as any) }

  async list(query: ActivosQuery): Promise<ActivosSummary> {
    const filters: Record<string, unknown> = { hotelId: query.hotelId }
    if (query.status) filters.status = query.status
    if (query.category) filters.category = query.category
    if (query.assignedTo) filters.assignedTo = query.assignedTo
    const data = await this.repo.findMany(filters)
    return { data, total: data.length }
  }

  async getById(id: string, hotelId: string): Promise<ActivosDTO> {
    const item = await this.repo.findOne({ id, hotelId })
    if (!item) throw new NotFoundError('Activo no encontrado')
    return item
  }

  async create(dto: CreateActivosDTO): Promise<ActivosDTO> {
    const item = await this.repo.create({ ...dto, status: 'available', assignedTo: null, assignedAt: null } as any)
    await this.sockets.onActivosCreated?.(item)
    return item
  }

  async update(id: string, hotelId: string, dto: UpdateActivosDTO): Promise<ActivosDTO> {
    await this.getById(id, hotelId)   // ownership
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Activo no encontrado')
    await this.sockets.onActivosUpdated?.(item)
    return item
  }

  async delete(id: string, hotelId: string, actor?: { id?: string; role?: string }): Promise<void> {
    const existing = await this.getById(id, hotelId)   // ownership
    await this.repo.delete(id)
    await this.sockets.onActivosDeleted?.(id)
    await auditSafely(this.auditPort, this.logger, {
      hotelId, userId: actor?.id, action: 'asset.delete',
      entity: 'asset', entityId: id, detail: `Activo "${existing.name}" eliminado`,
    })
  }

  /** Asigna el activo a un empleado del hotel. Valida pertenencia del empleado. */
  async assign(id: string, hotelId: string, employeeId: string): Promise<ActivosDTO> {
    const asset = await this.getById(id, hotelId)
    if (asset.status === 'retired') throw new ValidationError('Un activo retirado no se puede asignar')
    if (this.profileRepo) {
      const employee = await this.profileRepo.findOne({ id: employeeId, hotelId })
      if (!employee) throw new ValidationError('El empleado no pertenece a este hotel')
    }
    return this.repo.update(id, { assignedTo: employeeId, status: 'assigned', assignedAt: new Date().toISOString() } as any) as Promise<ActivosDTO>
  }

  /** Devuelve el activo al inventario (queda disponible). */
  async returnAsset(id: string, hotelId: string): Promise<ActivosDTO> {
    await this.getById(id, hotelId)   // ownership
    return this.repo.update(id, { assignedTo: null, status: 'available', assignedAt: null } as any) as Promise<ActivosDTO>
  }
}
