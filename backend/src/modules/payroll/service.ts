// payroll/service.ts — Facade del módulo Payroll

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import type {
  PayrollConfigDTO, CreatePayrollConfigDTO,
  PayrollConceptDTO, CreatePayrollConceptDTO,
  PayrollRunDTO, CreatePayrollRunDTO,
  PayrollRunDetailDTO,
  PayrollPayslipDTO,
  PayrollPaymentHistoryDTO,
  PayrollEmployeeInput, PayrollCalculationResult,
  PayrollCurrentUser, PayrollPaymentMethod,
} from './types'
import type { PayrollSockets } from './sockets'
import { PayrollCalculatorUseCase } from './usecases/calculator'
import { PayrollConfigUseCase } from './usecases/config'
import { PayrollConceptUseCase } from './usecases/concepts'
import { PayrollRunUseCase } from './usecases/runs'

export class PayrollService {
  private sockets: PayrollSockets = {}
  private calculator: PayrollCalculatorUseCase
  private config: PayrollConfigUseCase
  private concepts: PayrollConceptUseCase
  private runs: PayrollRunUseCase

  constructor(
    configRepo: RepositoryAdapter<PayrollConfigDTO>,
    conceptRepo: RepositoryAdapter<PayrollConceptDTO>,
    runRepo: RepositoryAdapter<PayrollRunDTO>,
    detailRepo: RepositoryAdapter<PayrollRunDetailDTO>,
    payslipRepo: RepositoryAdapter<PayrollPayslipDTO>,
    paymentHistoryRepo: RepositoryAdapter<PayrollPaymentHistoryDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    private readonly auth?: Auth,
  ) {
    this.calculator = new PayrollCalculatorUseCase(conceptRepo, configRepo, logger)
    this.config = new PayrollConfigUseCase(configRepo, logger)
    this.concepts = new PayrollConceptUseCase(conceptRepo, logger, auth)
    this.runs = new PayrollRunUseCase(runRepo, detailRepo, payslipRepo, logger, auth)
  }

  setSockets(s: Partial<PayrollSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]; if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // ─── Config ───────────────────────────────────────────
  async getConfig(hotelId: string): Promise<PayrollConfigDTO> { return this.config.getOrCreate(hotelId) }
  async updateConfig(hotelId: string, data: Partial<CreatePayrollConfigDTO>): Promise<PayrollConfigDTO> { return this.config.update(hotelId, data) }

  // ─── Concepts ─────────────────────────────────────────
  async seedConcepts(hotelId: string): Promise<void> { return this.concepts.seedDefaultConcepts(hotelId) }
  async getConcept(id: string, currentUser?: PayrollCurrentUser): Promise<PayrollConceptDTO> { return this.concepts.getById(id, currentUser) }
  async listConcepts(hotelId: string): Promise<PayrollConceptDTO[]> { return this.concepts.list(hotelId) }
  async createConcept(dto: CreatePayrollConceptDTO): Promise<PayrollConceptDTO> { return this.concepts.create(dto) }
  async updateConcept(id: string, data: Partial<CreatePayrollConceptDTO>, currentUser?: PayrollCurrentUser): Promise<PayrollConceptDTO> { return this.concepts.update(id, data, currentUser) }
  async deleteConcept(id: string, currentUser?: PayrollCurrentUser): Promise<void> { return this.concepts.delete(id, currentUser) }

  // ─── Runs ─────────────────────────────────────────────
  async createRun(dto: CreatePayrollRunDTO): Promise<PayrollRunDTO> { return this.runs.create(dto) }
  async getRun(id: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> { return this.runs.getById(id, currentUser) }
  async listRuns(hotelId: string): Promise<PayrollRunDTO[]> { return this.runs.list(hotelId) }
  async getRunDetails(runId: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDetailDTO[]> { return this.runs.getDetails(runId, currentUser) }
  async approveRun(id: string, approvedBy: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> { return this.runs.approve(id, approvedBy, currentUser) }
  /**
   * Pagar la nómina saca plata del hotel. El conector `payroll-gastos` escucha `onRunPaid` y asienta
   * el egreso; antes el evento estaba declarado y nunca se emitía, así que el costo laboral no
   * aparecía en el balance, ni en reportes, ni en caja.
   */
  async markRunAsPaid(id: string, currentUser?: PayrollCurrentUser, paymentMethod?: PayrollPaymentMethod): Promise<PayrollRunDTO> {
    const run = await this.runs.markAsPaid(id, currentUser, paymentMethod)
    await this.sockets.onRunPaid?.(run)
    return run
  }
  async cancelRun(id: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> { return this.runs.cancel(id, currentUser) }

  // ─── Calculate ────────────────────────────────────────
  async calculateRun(runId: string, employees: PayrollEmployeeInput[], currentUser?: PayrollCurrentUser): Promise<PayrollCalculationResult> {
    const run = await this.runs.getById(runId, currentUser)
    const config = await this.config.getOrCreate(run.hotelId)
    await this.concepts.seedDefaultConcepts(run.hotelId)
    const result = await this.calculator.calculate(run.hotelId, run.period, config, employees)
    await this.runs.saveCalculationResults(runId, result.employees, currentUser)
    return result
  }
}
