// empleados/usecases/contracts.ts — Contract management

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { ContractDTO, CreateContractDTO } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'

export class ContractUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<ContractDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreateContractDTO): Promise<ContractDTO> {
    if (dto.salary <= 0) throw new ValidationError('Salary must be positive')
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)
    return this.repo.create({
      ...dto,
      status: 'active',
      currency: dto.currency ?? 'USD',
    } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<ContractDTO> {
    const contract = await this.repo.findById(id)
    if (!contract) throw new NotFoundError('Contract not found')
    if (this.auth && user) this.auth.assertOwnership(contract.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return contract
  }

  async list(hotelId: string, employeeId?: string): Promise<ContractDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  async terminate(id: string, user?: SimpleUser): Promise<ContractDTO> {
    const contract = await this.getById(id, user)
    if (contract.status === 'terminated') throw new ValidationError('Contract already terminated')
    return this.repo.update(id, { status: 'terminated' } as any) as Promise<ContractDTO>
  }
}
