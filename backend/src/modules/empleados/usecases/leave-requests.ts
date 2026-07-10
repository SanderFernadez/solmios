// empleados/usecases/leave-requests.ts — Leave request workflow

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { LeaveRequestDTO, CreateLeaveRequestDTO } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'

export class LeaveRequestUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<LeaveRequestDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreateLeaveRequestDTO): Promise<LeaveRequestDTO> {
    if (dto.days <= 0) throw new ValidationError('Days must be positive')
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)
    // Validate days against date range
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate)
      const end = new Date(dto.endDate)
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
      if (dto.days !== diffDays) {
        throw new ValidationError(`Days (${dto.days}) doesn't match date range (${diffDays} days)`)
      }
    }
    return this.repo.create({ ...dto, status: 'pending' } as any)
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
