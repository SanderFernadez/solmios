// empleados/usecases/departments.ts — Department CRUD

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { DepartmentDTO, CreateDepartmentDTO } from '../types'
import type { SimpleUser } from './ownership'

export class DepartmentUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<DepartmentDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreateDepartmentDTO): Promise<DepartmentDTO> {
    if (!dto.name || dto.name.length < 2) throw new ValidationError('Department name required (min 2 chars)')
    return this.repo.create({ ...dto, active: 1 } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<DepartmentDTO> {
    const dept = await this.repo.findById(id)
    if (!dept) throw new NotFoundError('Department not found')
    if (this.auth && user) this.auth.assertOwnership(dept.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return dept
  }

  async list(hotelId: string): Promise<DepartmentDTO[]> {
    const filters: Record<string, any> = { active: 1 }
    if (hotelId) filters.hotelId = hotelId
    return this.repo.findMany(filters)
  }

  async update(id: string, data: Partial<CreateDepartmentDTO>, user?: SimpleUser): Promise<DepartmentDTO> {
    await this.getById(id, user)
    return this.repo.update(id, data as any) as Promise<DepartmentDTO>
  }

  async delete(id: string, user?: SimpleUser): Promise<void> {
    await this.getById(id, user)
    await this.repo.update(id, { active: 0 } as any)
  }
}
