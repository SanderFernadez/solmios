// empleados/usecases/contracts.ts — Contract management

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { ContractDTO, CreateContractDTO } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'

// Mismo criterio que profiles.ts: el salario es dato sensible. Un usuario con `users:view`
// (ej. recepción) NO debe ver los sueldos de sus colegas — solo los roles privilegiados.
const PRIVILEGED_ROLES = ['hotel_admin', 'super_admin']

function stripSalary(contract: any, userRole?: string): any {
  if (!userRole || PRIVILEGED_ROLES.includes(userRole)) return contract
  const { salary, ...rest } = contract
  return rest
}

export class ContractUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<ContractDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreateContractDTO): Promise<ContractDTO> {
    if (dto.salary <= 0) throw new ValidationError('El salario debe ser positivo')
    // #177: la fecha de inicio no puede ser a futuro (un contrato se registra al arrancar, no antes),
    // y el fin nunca puede ser anterior al inicio.
    const today = new Date().toISOString().slice(0, 10)
    if (dto.startDate && dto.startDate > today) throw new ValidationError('La fecha de inicio no puede ser futura')
    if (dto.endDate && dto.startDate && dto.endDate < dto.startDate) throw new ValidationError('La fecha de fin no puede ser anterior al inicio')
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)
    return this.repo.create({
      ...dto,
      status: 'active',
      currency: dto.currency ?? 'USD',
    } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<ContractDTO> {
    const contract = await this.repo.findById(id)
    if (!contract) throw new NotFoundError('Contrato no encontrado')
    if (this.auth && user) this.auth.assertOwnership(contract.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return stripSalary(contract, user?.role)
  }

  async list(hotelId: string, employeeId?: string, user?: SimpleUser): Promise<ContractDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    const contracts = await this.repo.findMany(filters)
    return contracts.map((c) => stripSalary(c, user?.role))
  }

  async terminate(id: string, user?: SimpleUser): Promise<ContractDTO> {
    const contract = await this.getById(id, user)
    if (contract.status === 'terminated') throw new ValidationError('El contrato ya está terminado')
    const updated = await this.repo.update(id, { status: 'terminated' } as any)
    return stripSalary(updated, user?.role)
  }
}
