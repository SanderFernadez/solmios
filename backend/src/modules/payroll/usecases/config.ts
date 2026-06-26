// payroll/usecases/config.ts — Config CRUD

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PayrollConfigDTO, CreatePayrollConfigDTO } from '../types'

export class PayrollConfigUseCase {
  constructor(private readonly repo: RepositoryAdapter<PayrollConfigDTO>, private readonly logger: Logger) {}

  async getOrCreate(hotelId: string): Promise<PayrollConfigDTO> {
    const existing = await this.repo.findOne({ hotelId })
    if (existing) return existing
    return this.repo.create({
      hotelId, currency: 'DOP', paymentFrequency: 'monthly', paymentDay: 25,
      overtimeMultiplier: 1.5, socialSecurityRate: 7.1, healthInsuranceRate: 3.04,
      incomeTaxRates: JSON.stringify([{ from: 0, to: 34685, rate: 0 }, { from: 34685, to: 52027, rate: 15 }, { from: 52027, to: 72260, rate: 20 }, { from: 72260, rate: 25 }]),
      aguinaldoEnabled: 1, aguinaldoMonths: 2,
    } as any)
  }

  async update(hotelId: string, data: Partial<CreatePayrollConfigDTO>): Promise<PayrollConfigDTO> {
    const config = await this.getOrCreate(hotelId)
    return this.repo.update(config.id, data as any) as Promise<PayrollConfigDTO>
  }
}
