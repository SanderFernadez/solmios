// empleados/usecases/hr-catalog.ts — Catálogos de RRHH (Odoo hr.job / hr.contract.type / hr.work.location).
//
// Puestos, tipos de contrato y ubicaciones de trabajo. Todo findOne({id,hotelId}) scoped → sin IDOR.
// Los tipos de contrato se auto-siembran (ninguna UI de contratos debería aparecer sin opciones).

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type {
  JobPositionDTO, CreateJobPositionDTO,
  ContractTypeDTO, CreateContractTypeDTO,
  WorkLocationDTO, CreateWorkLocationDTO,
} from '../types'

const DEFAULT_CONTRACT_TYPES: Omit<CreateContractTypeDTO, 'hotelId'>[] = [
  { code: 'full_time', name: 'Tiempo completo' },
  { code: 'part_time', name: 'Medio tiempo' },
  { code: 'temporary', name: 'Temporal' },
  { code: 'seasonal', name: 'Por temporada' },
  { code: 'internship', name: 'Pasantía' },
]

export class HrCatalogUseCase {
  constructor(
    private readonly jobRepo: RepositoryAdapter<JobPositionDTO>,
    private readonly contractTypeRepo: RepositoryAdapter<ContractTypeDTO>,
    private readonly locationRepo: RepositoryAdapter<WorkLocationDTO>,
    private readonly logger: Logger,
  ) {}

  // ── Job Positions ───────────────────────────────────────
  async listJobs(hotelId: string): Promise<JobPositionDTO[]> {
    return this.jobRepo.findMany({ hotelId, active: 1 })
  }
  async createJob(dto: CreateJobPositionDTO): Promise<JobPositionDTO> {
    if (!dto.name) throw new ValidationError('name es obligatorio')
    return this.jobRepo.create({ ...dto, expectedEmployees: dto.expectedEmployees ?? 1, active: 1 } as any)
  }
  async updateJob(id: string, hotelId: string, data: Partial<CreateJobPositionDTO>): Promise<JobPositionDTO> {
    const j = await this.jobRepo.findOne({ id, hotelId })
    if (!j) throw new NotFoundError('Puesto no encontrado')
    return this.jobRepo.update(id, data as any) as Promise<JobPositionDTO>
  }
  async deleteJob(id: string, hotelId: string): Promise<void> {
    const j = await this.jobRepo.findOne({ id, hotelId })
    if (!j) throw new NotFoundError('Puesto no encontrado')
    await this.jobRepo.update(id, { active: 0 } as any)
  }

  // ── Contract Types (con seed) ───────────────────────────
  async listContractTypes(hotelId: string): Promise<ContractTypeDTO[]> {
    const existing = await this.contractTypeRepo.findMany({ hotelId, active: 1 })
    if (existing.length) return existing
    for (const t of DEFAULT_CONTRACT_TYPES) await this.contractTypeRepo.create({ ...t, hotelId, active: 1 } as any)
    return this.contractTypeRepo.findMany({ hotelId, active: 1 })
  }
  async createContractType(dto: CreateContractTypeDTO): Promise<ContractTypeDTO> {
    if (!dto.code || !dto.name) throw new ValidationError('code y name son obligatorios')
    return this.contractTypeRepo.create({ ...dto, active: 1 } as any)
  }
  async deleteContractType(id: string, hotelId: string): Promise<void> {
    const t = await this.contractTypeRepo.findOne({ id, hotelId })
    if (!t) throw new NotFoundError('Tipo de contrato no encontrado')
    await this.contractTypeRepo.update(id, { active: 0 } as any)
  }

  // ── Work Locations ──────────────────────────────────────
  async listLocations(hotelId: string): Promise<WorkLocationDTO[]> {
    return this.locationRepo.findMany({ hotelId, active: 1 })
  }
  async createLocation(dto: CreateWorkLocationDTO): Promise<WorkLocationDTO> {
    if (!dto.name) throw new ValidationError('name es obligatorio')
    return this.locationRepo.create({ ...dto, active: 1 } as any)
  }
  async deleteLocation(id: string, hotelId: string): Promise<void> {
    const l = await this.locationRepo.findOne({ id, hotelId })
    if (!l) throw new NotFoundError('Ubicación no encontrada')
    await this.locationRepo.update(id, { active: 0 } as any)
  }
}
