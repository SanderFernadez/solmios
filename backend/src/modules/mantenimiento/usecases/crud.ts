// crud.ts — Alta, edición y borrado de un ticket de mantenimiento.
//
// Vive fuera del service para que el facade no se convierta en un God Object
// (el gate de `arckode analyze` rechaza un service > 200 líneas). Los efectos
// —sockets, invalidación de caché, auditoría— entran por callbacks: el usecase
// no conoce el transporte.
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  MantenimientoDTO,
  CreateMantenimientoDTO,
  UpdateMantenimientoDTO,
} from '../types'
import type { AuditUseCase } from './audit'
import { assertTransition } from './timings'
import { findOwnedTicket } from '../helpers'

type User = { id: string; role: string; hotelId?: string }

export interface CrudEffects {
  onCreated?: (item: MantenimientoDTO) => Promise<void>
  onUpdated?: (item: MantenimientoDTO) => Promise<void>
  onDeleted?: (id: string) => Promise<void>
  onAssigned?: (item: MantenimientoDTO) => Promise<void>
  invalidate: (hotelId?: string) => Promise<void>
  /** Audit log GLOBAL, para dejar rastro de quién borró el ticket. */
  auditDelete: (existing: MantenimientoDTO, user: User, id: string) => Promise<void>
}

export class CrudUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<MantenimientoDTO>,
    /** Historial interno del ticket (tabla maintenance_audit). */
    private readonly audit: AuditUseCase,
    private readonly effects: CrudEffects,
  ) {}

  async create(dto: CreateMantenimientoDTO, user: User): Promise<MantenimientoDTO> {
    if (user.role !== 'super_admin' && dto.hotelId !== user.hotelId) {
      throw new NotFoundError('No autorizado para crear en otro hotel')
    }
    // `reportedBy` sale del token, nunca del cliente: es trazabilidad de quién reportó.
    const item = await this.repo.create({ ...dto, reportedBy: user.id } as any)
    await this.audit.log(item.id, dto.hotelId, user.id, 'created', null, item.title)
    await this.effects.onCreated?.(item)
    // Si nace ya asignado a un técnico, avisale a esa persona.
    if (item.assignedTo) await this.effects.onAssigned?.(item)
    await this.effects.invalidate(dto.hotelId)
    return item
  }

  async update(id: string, dto: UpdateMantenimientoDTO, user: User): Promise<MantenimientoDTO> {
    const existing = await findOwnedTicket(this.repo, id, user)
    await this.logChanges(id, existing.hotelId, user.id, existing, dto)
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    await this.effects.onUpdated?.(item)
    // Aviso dirigido: solo cuando el ticket cambia de técnico, no en cada edición.
    if (dto.assignedTo && dto.assignedTo !== existing.assignedTo) {
      await this.effects.onAssigned?.(item)
    }
    await this.effects.invalidate(existing.hotelId)
    return item
  }

  async delete(id: string, user: User): Promise<void> {
    const existing = await findOwnedTicket(this.repo, id, user)
    await this.repo.delete(id)
    await this.effects.onDeleted?.(id)
    await this.effects.invalidate(existing.hotelId)
    // El historial del ticket (maintenance_audit) muere con el ticket: sin esta
    // entrada, borrar una orden no deja rastro de QUIÉN la hizo desaparecer.
    await this.effects.auditDelete(existing, user, id)
  }

  /** Deja en el historial del ticket qué cambió y a qué. */
  private async logChanges(
    id: string,
    hotelId: string,
    userId: string,
    existing: MantenimientoDTO,
    dto: UpdateMantenimientoDTO,
  ): Promise<void> {
    if (dto.status && dto.status !== existing.status) {
      assertTransition(existing.status, dto.status)
      await this.audit.log(id, hotelId, userId, 'status_change', existing.status, dto.status)
    }
    if (dto.assignedTo !== undefined && dto.assignedTo !== existing.assignedTo) {
      await this.audit.log(id, hotelId, userId, 'assignment', existing.assignedTo ?? null, dto.assignedTo ?? null)
    }
    // Pasar un ticket a un proveedor externo (o sacarlo) es una decisión que hay
    // que poder rastrear igual que un cambio de técnico.
    if (dto.providerId !== undefined && dto.providerId !== existing.providerId) {
      await this.audit.log(id, hotelId, userId, 'assignment', existing.providerId ?? null, dto.providerId ?? null)
    }
    if (dto.priority && dto.priority !== existing.priority) {
      await this.audit.log(id, hotelId, userId, 'priority_change', existing.priority ?? null, dto.priority)
    }
  }
}
