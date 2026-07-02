// payroll/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateConceptSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  code: { type: 'string' as const, required: true, max: 20 },
  name: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true, enum: ['earning','deduction','contribution','tax'] },
  calculationMethod: { type: 'string' as const, required: true, enum: ['fixed','percentage','formula','hours_based'] },
  value: { type: 'number' as const },
  priority: { type: 'number' as const },
}

export const CreateRunSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  period: { type: 'string' as const, required: true },
  startDate: { type: 'string' as const, required: true },
  endDate: { type: 'string' as const, required: true },
  paymentDate: { type: 'string' as const, required: true },
}

export const CalculateSchema: Record<string, ValidationRule> = {
  employees: { type: 'array' as any, required: true },
}

export const UpdateConfigSchema: Record<string, ValidationRule> = {
  paymentFrequency: { type: 'string' as const },
  paymentDay: { type: 'number' as const, min: 1, max: 31 },
  overtimeMultiplier: { type: 'number' as const, min: 1 },
  nightShiftMultiplier: { type: 'number' as const, min: 1 },
  holidayMultiplier: { type: 'number' as const, min: 1 },
  socialSecurityRate: { type: 'number' as const, min: 0, max: 100 },
  healthInsuranceRate: { type: 'number' as const, min: 0, max: 100 },
  minimumWage: { type: 'number' as const, min: 0 },
  maxOvertimeHoursWeekly: { type: 'number' as const, min: 0 },
  provisionType: { type: 'string' as const },
  aguinaldoEnabled: { type: 'number' as const },
  aguinaldoMonths: { type: 'number' as const, min: 1, max: 12 },
}
