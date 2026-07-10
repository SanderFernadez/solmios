// payroll/model.ts — 6 tablas de nómina
import type { ModelDefinition, ORM } from 'arckode-framework'

const PayrollConfigModel: ModelDefinition = {
  table: 'payroll_config',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    currency: { type: 'string', default: 'USD' },
    paymentFrequency: { type: 'string', required: true },
    paymentDay: { type: 'number', required: true },
    overtimeMultiplier: { type: 'number', default: 1.5 },
    nightShiftMultiplier: { type: 'number', default: 1.25 },
    holidayMultiplier: { type: 'number', default: 2.0 },
    socialSecurityRate: { type: 'number' },
    healthInsuranceRate: { type: 'number' },
    incomeTaxRates: { type: 'string' },
    minimumWage: { type: 'number' },
    maxOvertimeHoursWeekly: { type: 'number', default: 12 },
    provisionType: { type: 'string', default: 'monthly' },
    yearEndBonusEnabled: { type: 'boolean', default: 1 },
    yearEndBonusMonths: { type: 'number', default: 2 },
  },
  timestamps: true,
}

const PayrollConceptModel: ModelDefinition = {
  table: 'payroll_concepts',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    code: { type: 'string', required: true },
    name: { type: 'string', required: true },
    type: { type: 'string', required: true },
    calculationMethod: { type: 'string', required: true },
    value: { type: 'number' },
    formula: { type: 'string' },
    appliesTo: { type: 'string' },
    priority: { type: 'number', default: 0 },
    active: { type: 'boolean', default: 1 },
    system: { type: 'boolean', default: 0 },
  },
  timestamps: true,
}

const PayrollRunModel: ModelDefinition = {
  table: 'payroll_runs',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    period: { type: 'string', required: true },
    startDate: { type: 'string', required: true },
    endDate: { type: 'string', required: true },
    paymentDate: { type: 'string', required: true },
    status: { type: 'string', required: true, default: 'draft' },
    totalGross: { type: 'number', default: 0 },
    totalDeductions: { type: 'number', default: 0 },
    totalNet: { type: 'number', default: 0 },
    employeeCount: { type: 'number', default: 0 },
    approvedBy: { type: 'string' },
    approvedAt: { type: 'string' },
    paidAt: { type: 'string' },
    // Con qué se pagó la nómina. Solo `cash` mueve el cajón físico, vía gastos-caja.
    paymentMethod: { type: 'string', default: 'transfer' },
  },
  timestamps: true,
}

const PayrollRunDetailModel: ModelDefinition = {
  table: 'payroll_run_details',
  fields: {
    runId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    baseSalary: { type: 'number', required: true },
    daysWorked: { type: 'number', required: true },
    hoursWorked: { type: 'number', required: true },
    overtimeHours: { type: 'number', default: 0 },
    absences: { type: 'number', default: 0 },
    lateArrivals: { type: 'number', default: 0 },
    earnings: { type: 'string' },
    deductions: { type: 'string' },
    grossPay: { type: 'number', required: true },
    totalDeductions: { type: 'number', required: true },
    netPay: { type: 'number', required: true },
    status: { type: 'string', required: true, default: 'pending' },
    payslipGenerated: { type: 'boolean', default: 0 },
  },
  timestamps: true,
}

const PayrollPayslipModel: ModelDefinition = {
  table: 'payroll_payslips',
  fields: {
    runDetailId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    period: { type: 'string', required: true },
    payslipNumber: { type: 'string', required: true },
    pdfPath: { type: 'string' },
    sentAt: { type: 'string' },
    sentVia: { type: 'string' },
    viewedAt: { type: 'string' },
  },
  timestamps: true,
}

const PayrollPaymentHistoryModel: ModelDefinition = {
  table: 'payroll_payment_history',
  fields: {
    runId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    // Multi-tenancy: sin hotelId, un reporte de pagos no puede filtrar por hotel. El resto de las
    // tablas del proyecto lo tienen; ésta no lo tenía porque nadie la poblaba (ver runs.markAsPaid).
    hotelId: { type: 'string', required: true, indexed: true },
    amount: { type: 'number', required: true },
    method: { type: 'string', required: true },
    reference: { type: 'string' },
    paidAt: { type: 'string', required: true },
    notes: { type: 'string' },
  },
  timestamps: true,
}

export function registerPayrollModels(orm: ORM): void {
  orm.define('PayrollConfig', PayrollConfigModel)
  orm.define('PayrollConcept', PayrollConceptModel)
  orm.define('PayrollRun', PayrollRunModel)
  orm.define('PayrollRunDetail', PayrollRunDetailModel)
  orm.define('PayrollPayslip', PayrollPayslipModel)
  orm.define('PayrollPaymentHistory', PayrollPaymentHistoryModel)
}
