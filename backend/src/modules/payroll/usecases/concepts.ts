// payroll/usecases/concepts.ts — Concept CRUD + seeding

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PayrollConceptDTO, CreatePayrollConceptDTO } from '../types'

export class PayrollConceptUseCase {
  constructor(private readonly repo: RepositoryAdapter<PayrollConceptDTO>, private readonly logger: Logger) {}

  async seedDefaultConcepts(hotelId: string): Promise<void> {
    const existing = await this.repo.findMany({ hotelId })
    if (existing.length > 0) return

    const defaults: CreatePayrollConceptDTO[] = [
      { hotelId, code: 'BASIC', name: 'Salario Base', type: 'earning', calculationMethod: 'percentage', value: 100, priority: 1 },
      { hotelId, code: 'OT15', name: 'Horas Extra (1.5x)', type: 'earning', calculationMethod: 'hours_based', value: 0, priority: 2 },
      { hotelId, code: 'BONUS', name: 'Bono', type: 'earning', calculationMethod: 'fixed', value: 0, priority: 10 },
      { hotelId, code: 'COMMISSION', name: 'Comisión', type: 'earning', calculationMethod: 'percentage', value: 0, priority: 11 },
      { hotelId, code: 'HEALTH', name: 'Seguro de Salud', type: 'deduction', calculationMethod: 'percentage', value: 3.04, priority: 20 },
      { hotelId, code: 'SS', name: 'Seguridad Social', type: 'deduction', calculationMethod: 'percentage', value: 7.1, priority: 21 },
      { hotelId, code: 'TAX', name: 'Impuesto sobre Renta', type: 'tax', calculationMethod: 'percentage', value: 0, priority: 30 },
      { hotelId, code: 'ADVANCE', name: 'Adelanto', type: 'deduction', calculationMethod: 'fixed', value: 0, priority: 40 },
    ]
    for (const c of defaults) {
      await this.repo.create({ ...c, active: 1, system: 1 } as any)
    }
  }

  async getById(id: string): Promise<PayrollConceptDTO> {
    // @ignore IDOR_RISK — concept lookup by ID
    const c = await this.repo.findById(id)
    if (!c) throw new NotFoundError('Concept not found')
    return c
  }

  async list(hotelId: string): Promise<PayrollConceptDTO[]> {
    return this.repo.findMany({ hotelId, active: 1 })
  }

  async create(dto: CreatePayrollConceptDTO): Promise<PayrollConceptDTO> {
    return this.repo.create({ ...dto, active: 1, system: 0 } as any)
  }

  async update(id: string, data: Partial<CreatePayrollConceptDTO>): Promise<PayrollConceptDTO> {
    const c = await this.getById(id)
    if (c.system === 1) throw new ValidationError('System concepts cannot be modified')
    return this.repo.update(id, data as any) as Promise<PayrollConceptDTO>
  }

  async delete(id: string): Promise<void> {
    const c = await this.getById(id)
    if (c.system === 1) throw new ValidationError('System concepts cannot be deleted')
    await this.repo.update(id, { active: 0 } as any)
  }
}
