// payroll/usecases/runs.ts — Payroll run lifecycle

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type {
  PayrollRunDTO, CreatePayrollRunDTO,
  PayrollRunDetailDTO, PayrollPayslipDTO,
} from '../types'

export class PayrollRunUseCase {
  constructor(
    private readonly runRepo: RepositoryAdapter<PayrollRunDTO>,
    private readonly detailRepo: RepositoryAdapter<PayrollRunDetailDTO>,
    private readonly payslipRepo: RepositoryAdapter<PayrollPayslipDTO>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreatePayrollRunDTO): Promise<PayrollRunDTO> {
    const existing = await this.runRepo.findOne({ hotelId: dto.hotelId, period: dto.period })
    if (existing) throw new ValidationError('A payroll run already exists for this period')
    return this.runRepo.create({
      ...dto, status: 'draft', totalGross: 0, totalDeductions: 0, totalNet: 0, employeeCount: 0,
    } as any)
  }

  async getById(id: string): Promise<PayrollRunDTO> {
    // @ignore IDOR_RISK — run lookup by ID
    const run = await this.runRepo.findById(id)
    if (!run) throw new NotFoundError('Payroll run not found')
    return run
  }

  async list(hotelId: string): Promise<PayrollRunDTO[]> {
    return this.runRepo.findMany({ hotelId })
  }

  async getDetails(runId: string): Promise<PayrollRunDetailDTO[]> {
    return this.detailRepo.findMany({ runId })
  }

  async saveCalculationResults(
    runId: string,
    results: { employeeId: string; baseSalary: number; daysWorked: number; hoursWorked: number; overtimeHours: number; absences: number; earnings: any[]; deductions: any[]; grossPay: number; totalDeductions: number; netPay: number }[],
  ): Promise<PayrollRunDTO> {
    const run = await this.getById(runId)
    if (run.status !== 'draft') throw new ValidationError('Run must be in draft status to calculate')

    const totalGross = results.reduce((s, r) => s + r.grossPay, 0)
    const totalDeductions = results.reduce((s, r) => s + r.totalDeductions, 0)
    const totalNet = results.reduce((s, r) => s + r.netPay, 0)

    // Remove existing details for this run
    const existing = await this.detailRepo.findMany({ runId })
    for (const d of existing) {
      await this.detailRepo.delete(d.id)
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

  async approve(runId: string, approvedBy: string): Promise<PayrollRunDTO> {
    const run = await this.getById(runId)
    if (run.status !== 'calculated') throw new ValidationError('Run must be calculated before approval')

    const details = await this.detailRepo.findMany({ runId })

    // Generate payslips
    for (const d of details) {
      await this.payslipRepo.create({
        runDetailId: d.id, employeeId: d.employeeId, hotelId: run.hotelId,
        period: run.period,
        payslipNumber: `REC-${run.period}-${String(details.indexOf(d) + 1).padStart(3, '0')}`,
      } as any)
      await this.detailRepo.update(d.id, { status: 'approved', payslipGenerated: 1 } as any)
    }

    return this.runRepo.update(runId, {
      status: 'approved', approvedBy, approvedAt: new Date().toISOString(),
    } as any) as Promise<PayrollRunDTO>
  }

  async markAsPaid(runId: string): Promise<PayrollRunDTO> {
    const run = await this.getById(runId)
    if (run.status !== 'approved') throw new ValidationError('Run must be approved before payment')

    const details = await this.detailRepo.findMany({ runId })
    for (const d of details) {
      await this.detailRepo.update(d.id, { status: 'paid' } as any)
    }

    return this.runRepo.update(runId, {
      status: 'paid', paidAt: new Date().toISOString(),
    } as any) as Promise<PayrollRunDTO>
  }

  async cancel(runId: string): Promise<PayrollRunDTO> {
    const run = await this.getById(runId)
    if (run.status === 'paid') throw new ValidationError('Cannot cancel a paid run')

    const details = await this.detailRepo.findMany({ runId })
    for (const d of details) {
      await this.detailRepo.delete(d.id)
    }

    return this.runRepo.update(runId, { status: 'cancelled' } as any) as Promise<PayrollRunDTO>
  }
}
