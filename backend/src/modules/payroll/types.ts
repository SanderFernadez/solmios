// payroll/types.ts — DTOs y tipos

// Usuario autenticado mínimo necesario para ownership checks (IDOR).
// hotelId/role vienen del JWT (req.user) — ver create-permission-guard.ts.
export interface PayrollCurrentUser {
  id?: string
  hotelId?: string
  role?: string
}

// ─── Config ────────────────────────────────────────────
export interface PayrollConfigDTO {
  id: string
  hotelId: string
  currency: string
  paymentFrequency: string
  paymentDay: number
  overtimeMultiplier: number
  nightShiftMultiplier: number
  holidayMultiplier: number
  socialSecurityRate: number | null
  healthInsuranceRate: number | null
  incomeTaxRates: string | null
  minimumWage: number | null
  maxOvertimeHoursWeekly: number
  provisionType: string
  aguinaldoEnabled: number
  aguinaldoMonths: number
}

export interface CreatePayrollConfigDTO {
  hotelId: string
  currency?: string
  paymentFrequency: string
  paymentDay: number
  overtimeMultiplier?: number
  socialSecurityRate?: number
  healthInsuranceRate?: number
  incomeTaxRates?: string
  minimumWage?: number
  aguinaldoEnabled?: boolean
  aguinaldoMonths?: number
}

// ─── Concept ────────────────────────────────────────────
export interface PayrollConceptDTO {
  id: string
  hotelId: string
  code: string
  name: string
  type: string
  calculationMethod: string
  value: number | null
  formula: string | null
  appliesTo: string | null
  priority: number
  active: number
  system: number
}

export interface CreatePayrollConceptDTO {
  hotelId: string
  code: string
  name: string
  type: 'earning' | 'deduction' | 'contribution' | 'tax'
  calculationMethod: 'fixed' | 'percentage' | 'formula' | 'hours_based'
  value?: number
  formula?: string
  appliesTo?: string
  priority?: number
}

// ─── Run ────────────────────────────────────────────────
export interface PayrollRunDTO {
  id: string
  hotelId: string
  period: string
  startDate: string
  endDate: string
  paymentDate: string
  status: string
  totalGross: number
  totalDeductions: number
  totalNet: number
  employeeCount: number
  approvedBy: string | null
  approvedAt: string | null
  paidAt: string | null
}

export interface CreatePayrollRunDTO {
  hotelId: string
  period: string
  startDate: string
  endDate: string
  paymentDate: string
}

// ─── Run Detail ─────────────────────────────────────────
export interface PayrollRunDetailDTO {
  id: string
  runId: string
  employeeId: string
  baseSalary: number
  daysWorked: number
  hoursWorked: number
  overtimeHours: number
  absences: number
  lateArrivals: number
  earnings: string | null
  deductions: string | null
  grossPay: number
  totalDeductions: number
  netPay: number
  status: string
  payslipGenerated: number
}

// ─── Payslip ────────────────────────────────────────────
export interface PayrollPayslipDTO {
  id: string
  runDetailId: string
  employeeId: string
  hotelId: string
  period: string
  payslipNumber: string
  pdfPath: string | null
  sentAt: string | null
  sentVia: string | null
  viewedAt: string | null
}

// ─── Payment History ────────────────────────────────────
export interface PayrollPaymentHistoryDTO {
  id: string
  runId: string
  employeeId: string
  amount: number
  method: string
  reference: string | null
  paidAt: string
  notes: string | null
}

// ─── Calculation Types ──────────────────────────────────
export interface PayrollEmployeeInput {
  employeeId: string
  baseSalary: number
  daysWorked: number
  hoursWorked: number
  overtimeHours: number
  absences: number
  lateArrivals: number
}

export interface PayrollEarningItem {
  conceptId: string
  name: string
  code: string
  amount: number
}

export interface PayrollDeductionItem {
  conceptId: string
  name: string
  code: string
  amount: number
}

export interface PayrollEmployeeResult {
  employeeId: string
  baseSalary: number
  daysWorked: number
  hoursWorked: number
  overtimeHours: number
  absences: number
  earnings: PayrollEarningItem[]
  deductions: PayrollDeductionItem[]
  grossPay: number
  totalDeductions: number
  netPay: number
}

export interface PayrollCalculationResult {
  period: string
  employees: PayrollEmployeeResult[]
  totalGross: number
  totalDeductions: number
  totalNet: number
  employeeCount: number
}
