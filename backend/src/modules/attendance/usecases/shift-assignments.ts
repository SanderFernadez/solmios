// attendance/usecases/shift-assignments.ts — Calendario de turnos (roster).
//
// Qué turno le toca a cada empleado cada día. La clave de negocio es (employeeId, date): un empleado
// tiene UN turno por día (asignar de nuevo reemplaza). El rango de fechas se acota en memoria porque el
// WHERE del ORM no sabe de `$gte`/`$lte` (ver shared/usecases/date-range).

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { ShiftAssignmentDTO, CreateShiftAssignmentDTO } from '../types'
import { inDateRange } from '../../../shared/usecases/date-range'

export class ShiftAssignmentUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<ShiftAssignmentDTO>,
    private readonly scheduleRepo: RepositoryAdapter<{ id: string; hotelId: string }>,
    private readonly profileRepo: RepositoryAdapter<{ id: string; hotelId: string }>,
    private readonly logger: Logger,
  ) {}

  async list(hotelId: string, from?: string, to?: string, employeeId?: string): Promise<ShiftAssignmentDTO[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (employeeId) filters.employeeId = employeeId
    const rows = await this.repo.findMany(filters)
    return inDateRange(rows, 'date', from, to)
  }

  /** Asigna (o reemplaza) el turno de un empleado en una fecha. Valida que turno y empleado sean del hotel. */
  async assign(dto: CreateShiftAssignmentDTO): Promise<ShiftAssignmentDTO> {
    if (!dto.date) throw new ValidationError('date requerido')
    const schedule = await this.scheduleRepo.findOne({ id: dto.scheduleId, hotelId: dto.hotelId })
    if (!schedule) throw new ValidationError('El turno no pertenece a este hotel')
    const employee = await this.profileRepo.findOne({ id: dto.employeeId, hotelId: dto.hotelId })
    if (!employee) throw new ValidationError('El empleado no pertenece a este hotel')

    // Un turno por empleado por día: si ya hay, se reemplaza (no se duplica el roster).
    const existing = await this.repo.findOne({ hotelId: dto.hotelId, employeeId: dto.employeeId, date: dto.date })
    if (existing) {
      return this.repo.update(existing.id, { scheduleId: dto.scheduleId, notes: dto.notes ?? null } as any) as Promise<ShiftAssignmentDTO>
    }
    return this.repo.create({ ...dto, notes: dto.notes ?? null } as any)
  }

  async remove(id: string, hotelId: string): Promise<void> {
    // findOne con hotelId scopea por hotel por construcción: sin findById → sin IDOR. Una asignación
    // de otro hotel simplemente no matchea y da 404.
    const row = await this.repo.findOne({ id, hotelId })
    if (!row) throw new NotFoundError('Asignación no encontrada')
    await this.repo.delete(id)
  }
}
