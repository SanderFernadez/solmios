// empleados/usecases/leave-requests.ts — Leave request workflow

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { LeaveRequestDTO, CreateLeaveRequestDTO } from '../types'
import type { SimpleUser } from './ownership'

export class LeaveRequestUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<LeaveRequestDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreateLeaveRequestDTO): Promise<LeaveRequestDTO> {
    if (dto.days <= 0) throw new ValidationError('Days must be positive')
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
    return this.repo.update(id, {
      status: 'rejected',
      approvedBy,
      approvedAt: new Date().toISOString(),
      notes: reason ? `${request.notes}\nRejection: ${reason}`.trim() : request.notes,
    } as any) as Promise<LeaveRequestDTO>
  }
}
