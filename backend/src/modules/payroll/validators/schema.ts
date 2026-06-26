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
