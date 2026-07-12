// empleados/usecases/leave-requests.ts — Leave request workflow

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { LeaveRequestDTO, CreateLeaveRequestDTO } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'
import { countLeaveDays, type LeaveConfigUseCase } from './leave-config'

const MS_PER_DAY = 86_400_000

export class LeaveRequestUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<LeaveRequestDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
    private readonly config?: LeaveConfigUseCase,
  ) {}

  async create(dto: CreateLeaveRequestDTO): Promise<LeaveRequestDTO> {
    if (!dto.startDate || !dto.endDate) throw new ValidationError('startDate y endDate son obligatorios')
    if (dto.endDate < dto.startDate) throw new ValidationError('endDate no puede ser anterior a startDate')
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)

    // Días AUTO desde el rango, descontando festivos (#188). El `days` del cliente se ignora — el
    // servidor es la fuente de verdad, así no hay desajuste entre lo que el usuario tipeó y lo real.
    let days: number
    if (this.config) {
      const { exact, recurring } = await this.config.holidaySets(dto.hotelId)
      days = countLeaveDays(dto.startDate, dto.endDate, exact, recurring)
    } else {
      days = Math.ceil((new Date(dto.endDate).getTime() - new Date(dto.startDate).getTime()) / MS_PER_DAY) + 1
    }
    if (!(days > 0)) throw new ValidationError('El rango de fechas no genera días hábiles (¿todo festivo?)')

    return this.repo.create({ ...dto, days, status: 'pending' } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<LeaveRequestDTO> {
    const request = await this.repo.findById(id)
    if (!request) throw new NotFoundError('Leave request not found')
    if (this.auth && user) this.auth.assertOwnership(request.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return request
  }

  async list(hotelId: string, employeeId?: string, status?: string): Promise<LeaveRequestDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    if (status) filters.status = status
    return this.repo.findMany(filters)
  }

  async approve(id: string, approvedBy: string, user?: SimpleUser): Promise<LeaveRequestDTO> {
    const request = await this.getById(id, user)
    if (request.status !== 'pending') throw new ValidationError('Request already processed')
    return this.repo.update(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    } as any) as Promise<LeaveRequestDTO>
  }

  async reject(id: string, approvedBy: string, reason?: string, user?: SimpleUser): Promise<LeaveRequestDTO> {
    const request = await this.getById(id, user)
    if (request.status !== 'pending') throw new ValidationError('Request already processed')
    const notesParts: string[] = []
    if (request.notes) notesParts.push(request.notes)
    if (reason) notesParts.push(`Rejection: ${reason}`)
    return this.repo.update(id, {
      status: 'rejected',
      approvedBy,
      approvedAt: new Date().toISOString(),
      notes: notesParts.join('\n') || null,
    } as any) as Promise<LeaveRequestDTO>
  }
}
