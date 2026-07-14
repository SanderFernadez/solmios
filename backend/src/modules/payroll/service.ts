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
import type { PayrollPrefillPort, PayrollPrefillRow } from './types'
import { PayrollCalculatorUseCase } from './usecases/calculator'
import { PayrollConfigUseCase } from './usecases/config'
import { PayrollConceptUseCase } from './usecases/concepts'
import { PayrollRunUseCase } from './usecases/runs'
import { buildPayrollPrefill } from '../../shared/usecases/build-payroll-prefill'
import { renderPayslipHtml } from './usecases/payslip-template'
import {
  auditSafely, runEntry, conceptDeleteEntry,
  type AuditPort, type RunAction,
} from './usecases/audit'
import { NotFoundError, ValidationError } from 'arckode-framework'

/** Puerto de email por duck typing — lo cablea email-bootstrap con el EmailService. */
export interface PayslipEmailPort {
  isConfigured(hotelId: string): Promise<boolean>
  enqueue(input: { to: string; subject: string; html: string; hotelId: string }): Promise<string>
}

export class PayrollService {
  private sockets: PayrollSockets = {}
  private calculator: PayrollCalculatorUseCase
  private config: PayrollConfigUseCase
  private concepts: PayrollConceptUseCase
  private runs: PayrollRunUseCase
  private prefillPort?: PayrollPrefillPort
  private emailPort: PayslipEmailPort | null = null
  private hotelRepo: RepositoryAdapter<{ id: string; name?: string; currency?: string }> | null = null
  private auditPort: AuditPort | null = null

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
    // paymentHistoryRepo llegaba al constructor y se perdía: la tabla payroll_payment_history
    // quedaba huérfana. Ahora markAsPaid escribe una fila por empleado (ver usecases/runs.ts).
    this.runs = new PayrollRunUseCase(runRepo, detailRepo, payslipRepo, paymentHistoryRepo, configRepo, logger, auth)
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

  /** Conecta el audit log. Lo inyecta el connector `payroll-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  /** Registra el movimiento de la liquidación y devuelve el run intacto (auditar no puede romperlo). */
  private async auditRun(run: PayrollRunDTO, action: RunAction, actor?: PayrollCurrentUser): Promise<PayrollRunDTO> {
    await auditSafely(this.auditPort, this.logger, runEntry(run, action, actor))
    return run
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
  async deleteConcept(id: string, currentUser?: PayrollCurrentUser): Promise<void> {
    const concept = await this.concepts.getById(id, currentUser) // existencia + ownership
    await this.concepts.delete(id, currentUser)
    await auditSafely(this.auditPort, this.logger, conceptDeleteEntry(concept, currentUser))
  }

  // ─── Runs ─────────────────────────────────────────────
  async createRun(dto: CreatePayrollRunDTO): Promise<PayrollRunDTO> { return this.runs.create(dto) }
  async getRun(id: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> { return this.runs.getById(id, currentUser) }
  async listRuns(hotelId: string): Promise<PayrollRunDTO[]> { return this.runs.list(hotelId) }
  async getRunDetails(runId: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDetailDTO[]> { return this.runs.getDetails(runId, currentUser) }
  async approveRun(id: string, approvedBy: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> {
    return this.auditRun(await this.runs.approve(id, approvedBy, currentUser), 'payroll.run_approve', currentUser)
  }
  /**
   * Pagar la nómina saca plata del hotel. El conector `payroll-gastos` escucha `onRunPaid` y asienta
   * el egreso; antes el evento estaba declarado y nunca se emitía, así que el costo laboral no
   * aparecía en el balance, ni en reportes, ni en caja.
   */
  async markRunAsPaid(id: string, currentUser?: PayrollCurrentUser, paymentMethod?: PayrollPaymentMethod): Promise<PayrollRunDTO> {
    const run = await this.runs.markAsPaid(id, currentUser, paymentMethod)
    await this.sockets.onRunPaid?.(run)
    return this.auditRun(run, 'payroll.run_pay', currentUser)
  }

  async cancelRun(id: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> {
    return this.auditRun(await this.runs.cancel(id, currentUser), 'payroll.run_cancel', currentUser)
  }

  // ─── Recibos (PDF imprimible + email) — #157 ──────────
  /** email-bootstrap cablea el EmailService y el repo de hoteles (para el nombre del hotel). */
  setEmailDeps(emailPort: PayslipEmailPort, hotelRepo: RepositoryAdapter<{ id: string; name?: string; currency?: string }>): void {
    this.emailPort = emailPort
    this.hotelRepo = hotelRepo
  }

  private async buildPayslip(runId: string, detailId: string, currentUser?: PayrollCurrentUser) {
    const run = await this.runs.getById(runId, currentUser)          // existencia + ownership
    const details = await this.runs.getDetails(runId, currentUser)
    const detail = details.find((d) => d.id === detailId)
    if (!detail) throw new NotFoundError('Recibo no encontrado en esta liquidación')
    const hotel = this.hotelRepo ? await this.hotelRepo.findById(run.hotelId).catch(() => null) : null
    return { run, detail, hotelName: hotel?.name || 'Hotel', currency: hotel?.currency || 'DOP' }
  }

  /** HTML A4 del recibo — el navegador lo imprime a PDF (mismo enfoque que la factura). */
  async getPayslipHtml(runId: string, detailId: string, employeeName?: string, currentUser?: PayrollCurrentUser): Promise<string> {
    const { run, detail, hotelName, currency } = await this.buildPayslip(runId, detailId, currentUser)
    return renderPayslipHtml({ detail, run, hotelName, employeeName, currency })
  }

  /** Envía el recibo por email (cola del EmailService). Requiere email configurado en el hotel. */
  async emailPayslip(runId: string, detailId: string, to: string, employeeName: string | undefined, currentUser?: PayrollCurrentUser): Promise<{ queued: true; to: string }> {
    if (!this.emailPort) throw new NotFoundError('Servicio de email no configurado')
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ValidationError('Email de destino inválido')
    const { run, detail, hotelName, currency } = await this.buildPayslip(runId, detailId, currentUser)
    if (!(await this.emailPort.isConfigured(run.hotelId))) throw new ValidationError('El hotel no tiene email configurado')
    const html = renderPayslipHtml({ detail, run, hotelName, employeeName, currency })
    await this.emailPort.enqueue({ to, subject: `Recibo de nómina — ${run.period || run.startDate}`, html, hotelId: run.hotelId })
    return { queued: true, to }
  }

  // ─── Calculate ────────────────────────────────────────
  async calculateRun(runId: string, employees: PayrollEmployeeInput[], currentUser?: PayrollCurrentUser): Promise<PayrollCalculationResult> {
    const run = await this.runs.getById(runId, currentUser)
    const config = await this.config.getOrCreate(run.hotelId)
    await this.concepts.seedDefaultConcepts(run.hotelId)
    const result = await this.calculator.calculate(run.hotelId, run.period, config, employees)
    await this.runs.saveCalculationResults(runId, result.employees, currentUser)
    return result
  }

  // ─── Prefill desde Asistencia ─────────────────────────
  /** El conector `attendance-payroll` cablea este puerto. Sin él, el prefill devuelve []. */
  setPrefillPort(port: PayrollPrefillPort): void { this.prefillPort = port }

  /**
   * Arma la liquidación desde los fichajes reales: salario del legajo + horas de attendance.
   * El período y el hotel salen del RUN (confiables), nunca del cliente. Es solo lectura: el
   * contador revisa y corrige antes de calcular.
   */
  async getPrefill(runId: string, currentUser?: PayrollCurrentUser): Promise<PayrollPrefillRow[]> {
    const run = await this.runs.getById(runId, currentUser)   // existencia + ownership
    if (!this.prefillPort) {
      this.logger.warn('Prefill sin conector attendance-payroll: se devuelve vacío', { runId })
      return []
    }
    const [employees, report] = await Promise.all([
      this.prefillPort.listEmployees(run.hotelId),
      this.prefillPort.getReport(run.hotelId, run.startDate, run.endDate),
    ])
    const { rows, orphanFichajes } = buildPayrollPrefill(employees, report)
    if (orphanFichajes.length > 0) {
      this.logger.warn('Fichajes de empleados sin legajo activo: no se liquidan', { runId, orphanFichajes })
    }
    return rows
  }
}
