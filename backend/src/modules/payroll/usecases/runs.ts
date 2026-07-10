// payroll/usecases/runs.ts — Payroll run lifecycle

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type {
  PayrollRunDTO, CreatePayrollRunDTO,
  PayrollRunDetailDTO, PayrollPayslipDTO, PayrollPaymentHistoryDTO,
  PayrollCurrentUser, PayrollPaymentMethod,
} from '../types'
import { nextPayslipNumber } from './payslip-number'

export class PayrollRunUseCase {
  constructor(
    private readonly runRepo: RepositoryAdapter<PayrollRunDTO>,
    private readonly detailRepo: RepositoryAdapter<PayrollRunDetailDTO>,
    private readonly payslipRepo: RepositoryAdapter<PayrollPayslipDTO>,
    private readonly paymentHistoryRepo: RepositoryAdapter<PayrollPaymentHistoryDTO>,
    private readonly configRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreatePayrollRunDTO): Promise<PayrollRunDTO> {
    const existing = await this.runRepo.findOne({ hotelId: dto.hotelId, period: dto.period })
    if (existing) throw new ValidationError('A payroll run already exists for this period')
    return this.runRepo.create({
      ...dto, status: 'draft', totalGross: 0, totalDeductions: 0, totalNet: 0, employeeCount: 0,
    } as any)
  }

  async getById(id: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> {
    const run = await this.runRepo.findById(id)
    if (!run) throw new NotFoundError('Payroll run not found')
    // IDOR: una liquidación pertenece a un hotel — verificar ownership antes de
    // devolverla o de permitir cualquier transición de estado sobre ella.
    if (this.auth && currentUser?.hotelId) {
      this.auth.assertOwnership(run.hotelId, currentUser.hotelId, currentUser.role, 'super_admin')
    }
    return run
  }

  async list(hotelId: string): Promise<PayrollRunDTO[]> {
    return this.runRepo.findMany({ hotelId })
  }

  async getDetails(runId: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDetailDTO[]> {
    // El detalle no tiene hotelId propio — validar ownership vía el run padre
    // antes de exponer detalles salariales de otro hotel.
    await this.getById(runId, currentUser)
    return this.detailRepo.findMany({ runId })
  }

  async saveCalculationResults(
    runId: string,
    results: { employeeId: string; baseSalary: number; daysWorked: number; hoursWorked: number; overtimeHours: number; absences: number; earnings: any[]; deductions: any[]; grossPay: number; totalDeductions: number; netPay: number }[],
    currentUser?: PayrollCurrentUser,
  ): Promise<PayrollRunDTO> {
    const run = await this.getById(runId, currentUser)
    if (run.status !== 'draft') throw new ValidationError('Run must be in draft status to calculate')

    const totalGross = results.reduce((s, r) => s + r.grossPay, 0)
    const totalDeductions = results.reduce((s, r) => s + r.totalDeductions, 0)
    const totalNet = results.reduce((s, r) => s + r.netPay, 0)

    // Remove existing details for this run (batch delete)
    const existing = await this.detailRepo.findMany({ runId })
    if (existing.length) {
      await Promise.all(existing.map(d => this.detailRepo.delete(d.id)))
    }

    // Create new details
    for (const r of results) {
      await this.detailRepo.create({
        runId, employeeId: r.employeeId, baseSalary: r.baseSalary,
        daysWorked: r.daysWorked, hoursWorked: r.hoursWorked, overtimeHours: r.overtimeHours,
        absences: r.absences, lateArrivals: 0,
        earnings: JSON.stringify(r.earnings), deductions: JSON.stringify(r.deductions),
        grossPay: r.grossPay, totalDeductions: r.totalDeductions, netPay: r.netPay,
        status: 'calculated', payslipGenerated: 0,
      } as any)
    }

    return this.runRepo.update(runId, {
      status: 'calculated', totalGross, totalDeductions, totalNet, employeeCount: results.length,
    } as any) as Promise<PayrollRunDTO>
  }

  async approve(runId: string, approvedBy: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> {
    const run = await this.getById(runId, currentUser)
    if (run.status !== 'calculated') throw new ValidationError('Run must be calculated before approval')

    const details = await this.detailRepo.findMany({ runId })

    // Generate payslips with atomic counter (batch operations to avoid N+1)
    const payslipCreates = []
    const detailUpdates = []
    for (const d of details) {
      const payslipNumber = await nextPayslipNumber(this.configRepo, run.hotelId, run.period)
      payslipCreates.push(this.payslipRepo.create({
        runDetailId: d.id, employeeId: d.employeeId, hotelId: run.hotelId,
        period: run.period, payslipNumber,
      } as any))
      detailUpdates.push(this.detailRepo.update(d.id, { status: 'approved', payslipGenerated: 1 } as any))
    }
    await Promise.all([...payslipCreates, ...detailUpdates])

    return this.runRepo.update(runId, {
      status: 'approved', approvedBy, approvedAt: new Date().toISOString(),
    } as any) as Promise<PayrollRunDTO>
  }

  async markAsPaid(runId: string, currentUser?: PayrollCurrentUser, paymentMethod: PayrollPaymentMethod = 'transfer'): Promise<PayrollRunDTO> {
    const run = await this.getById(runId, currentUser)
    if (run.status !== 'approved') throw new ValidationError('Run must be approved before payment')

    // El pago sólo dejaba `status:'paid'` en la cabecera: cero rastro por empleado. Ahora cada detalle
    // asienta una fila en payroll_payment_history. La transición approved→paid ocurre una sola vez
    // (arriba se exige `approved`), pero se chequea existencia por si un reintento parcial la repite.
    const paidAt = new Date().toISOString()
    const details = await this.detailRepo.findMany({ runId })

    // Batch fetch existing payment histories to avoid N+1
    const existingPayments = await this.paymentHistoryRepo.findMany({ runId })
    const existingSet = new Set(existingPayments.map((p: any) => p.employeeId))

    const detailUpdates = []
    const historyCreates = []
    for (const d of details) {
      detailUpdates.push(this.detailRepo.update(d.id, { status: 'paid' } as any))
      if (!existingSet.has(d.employeeId)) {
        historyCreates.push(this.paymentHistoryRepo.create({
          runId, employeeId: d.employeeId, hotelId: run.hotelId,
          amount: d.netPay, method: paymentMethod, reference: run.period, paidAt,
        } as any))
      }
    }
    await Promise.all([...detailUpdates, ...historyCreates])

    return this.runRepo.update(runId, {
      status: 'paid', paidAt, paymentMethod,
    } as any) as Promise<PayrollRunDTO>
  }

  async cancel(runId: string, currentUser?: PayrollCurrentUser): Promise<PayrollRunDTO> {
    const run = await this.getById(runId, currentUser)
    if (run.status === 'paid') throw new ValidationError('Cannot cancel a paid run')

    const details = await this.detailRepo.findMany({ runId })
    if (details.length) {
      await Promise.all(details.map(d => this.detailRepo.delete(d.id)))
    }

    // Also clean up payment history records to prevent orphans
    const historyRecords = await this.paymentHistoryRepo.findMany({ runId })
    if (historyRecords.length) {
      await Promise.all(historyRecords.map(h => this.paymentHistoryRepo.delete(h.id)))
    }

    return this.runRepo.update(runId, { status: 'cancelled' } as any) as Promise<PayrollRunDTO>
  }
}
