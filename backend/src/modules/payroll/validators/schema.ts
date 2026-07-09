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

// `validateSchema` no tiene tipo `array`: declararlo como tal hacía que el campo NO se copiara al
// output y el controller leyera `undefined` → 500 en cada cálculo de nómina. El array lo estrecha
// el controller a mano. Este schema queda para los escalares que se sumen en el futuro.
export const CalculateSchema: Record<string, ValidationRule> = {}

// Sin método explícito se asume transferencia: es como se paga un sueldo salvo que digas otra cosa,
// y no toca el cajón físico. Solo `cash` mueve la caja.
export const MarkAsPaidSchema: Record<string, ValidationRule> = {
  paymentMethod: { type: 'string' as const, enum: ['cash', 'card', 'transfer', 'other'] },
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
  yearEndBonusEnabled: { type: 'number' as const },
  yearEndBonusMonths: { type: 'number' as const, min: 1, max: 12 },
}
