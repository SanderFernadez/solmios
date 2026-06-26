// services/Payroll.service.ts — API client nómina

import { http } from './http'
import { useAuthStore } from '@/stores/auth.store'

function hotelParam(): string {
  try {
    const auth = useAuthStore()
    const hid = auth.user?.hotelId
    return hid ? `?hotelId=${hid}` : ''
  } catch { return '' }
}

export interface PayrollConfig {
  id: string; hotelId: string; currency: string
  paymentFrequency: string; paymentDay: number
  overtimeMultiplier: number; nightShiftMultiplier: number; holidayMultiplier: number
  socialSecurityRate: number | null; healthInsuranceRate: number | null
  incomeTaxRates: string | null; minimumWage: number | null
  maxOvertimeHoursWeekly: number; provisionType: string
  aguinaldoEnabled: number; aguinaldoMonths: number
}

export interface PayrollConcept {
  id: string; hotelId: string; code: string; name: string
  type: string; calculationMethod: string
  value: number | null; formula: string | null
  appliesTo: string | null; priority: number; active: number; system: number
}

export interface PayrollRun {
  id: string; hotelId: string; period: string
  startDate: string; endDate: string; paymentDate: string
  status: string; totalGross: number; totalDeductions: number; totalNet: number
  employeeCount: number; approvedBy: string | null; approvedAt: string | null; paidAt: string | null
}

export interface PayrollRunDetail {
  id: string; runId: string; employeeId: string
  baseSalary: number; daysWorked: number; hoursWorked: number; overtimeHours: number
  absences: number; earnings: string; deductions: string
  grossPay: number; totalDeductions: number; netPay: number; status: string
}

export interface PayrollEmployeeInput {
  employeeId: string; baseSalary: number
  daysWorked: number; hoursWorked: number; overtimeHours: number
  absences: number; lateArrivals: number
}

export interface PayrollCalculationResult {
  period: string; employees: any[]; totalGross: number; totalDeductions: number; totalNet: number; employeeCount: number
}

export const PayrollService = {
  getConfig: (): Promise<PayrollConfig> => http.get(`/api/payroll/config${hotelParam()}`),
  updateConfig: (data: Partial<PayrollConfig>): Promise<PayrollConfig> => http.put(`/api/payroll/config${hotelParam()}`, data),

  listConcepts: (): Promise<PayrollConcept[]> => http.get(`/api/payroll/concepts${hotelParam()}`),
  createConcept: (data: Partial<PayrollConcept>): Promise<PayrollConcept> => http.post(`/api/payroll/concepts${hotelParam()}`, data),
  deleteConcept: (id: string): Promise<void> => http.delete(`/api/payroll/concepts/${id}${hotelParam()}`),

  listRuns: (): Promise<PayrollRun[]> => http.get(`/api/payroll/runs${hotelParam()}`),
  createRun: (data: Partial<PayrollRun>): Promise<PayrollRun> => http.post(`/api/payroll/runs${hotelParam()}`, data),
  getRun: (id: string): Promise<PayrollRun> => http.get(`/api/payroll/runs/${id}${hotelParam()}`),
  getRunDetails: (id: string): Promise<PayrollRunDetail[]> => http.get(`/api/payroll/runs/${id}/details${hotelParam()}`),
  calculate: (id: string, employees: PayrollEmployeeInput[]): Promise<PayrollCalculationResult> => http.post(`/api/payroll/runs/${id}/calculate${hotelParam()}`, { employees }),
  approve: (id: string): Promise<PayrollRun> => http.post(`/api/payroll/runs/${id}/approve${hotelParam()}`),
  markAsPaid: (id: string): Promise<PayrollRun> => http.post(`/api/payroll/runs/${id}/pay${hotelParam()}`),
  cancel: (id: string): Promise<PayrollRun> => http.post(`/api/payroll/runs/${id}/cancel${hotelParam()}`),
}
