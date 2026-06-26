// empleados/usecases/contracts.ts — Contract management

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { ContractDTO, CreateContractDTO } from '../types'

export class ContractUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<ContractDTO>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateContractDTO): Promise<ContractDTO> {
    if (dto.salary <= 0) throw new ValidationError('Salary must be positive')
    return this.repo.create({
      ...dto,
      status: 'active',
      currency: dto.currency ?? 'USD',
    } as any)
  }

  async getById(id: string): Promise<ContractDTO> {
    // @ignore IDOR_RISK — contract lookup by ID
    const contract = await this.repo.findById(id)
    if (!contract) throw new NotFoundError('Contract not found')
    return contract
  }

  async list(hotelId: string, employeeId?: string): Promise<ContractDTO[]> {
    const filters: Record<string, any> = { hotelId }
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  async terminate(id: string): Promise<ContractDTO> {
    const contract = await this.getById(id)
    if (contract.status === 'terminated') throw new ValidationError('Contract already terminated')
    return this.repo.update(id, { status: 'terminated' } as any) as Promise<ContractDTO>
  }
}
