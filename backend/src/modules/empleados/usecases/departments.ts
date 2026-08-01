// empleados/usecases/departments.ts — Department CRUD

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { DepartmentDTO, CreateDepartmentDTO } from '../types'
import type { SimpleUser } from './ownership'
import { auditSafely, type AuditPort } from '../../../shared/usecases/audit'

export class DepartmentUseCase {
  private auditPort: AuditPort | null = null

  constructor(
    private readonly repo: RepositoryAdapter<DepartmentDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  /** Conecta el audit log. Lo inyecta el connector `empleados-auditlog` vía el service. */
  setAuditPort(port: AuditPort): void {
    this.auditPort = port
  }

  async create(dto: CreateDepartmentDTO): Promise<DepartmentDTO> {
    if (!dto.name || dto.name.length < 2) throw new ValidationError('El nombre del departamento es obligatorio (mínimo 2 caracteres)')
    return this.repo.create({ ...dto, active: 1 } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<DepartmentDTO> {
    const dept = await this.repo.findById(id)
    if (!dept) throw new NotFoundError('Departamento no encontrado')
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
    const dept = await this.getById(id, user)
    await this.repo.update(id, { active: 0 } as any)
    // SC-05: baja de una unidad organizativa de RRHH → queda registrada.
    await auditSafely(this.auditPort, this.logger, {
      hotelId: dept.hotelId, userId: user?.id, action: 'department.delete',
      entity: 'department', entityId: id,
      detail: `Departamento "${dept.name}" eliminado`,
    })
  }
}
