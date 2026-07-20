// payroll/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateConceptSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  code: { type: 'string' as const, required: true, max: 20 },
  name: { type: 'string' as const, required: true, max: 80 },
  type: { type: 'string' as const, required: true, enum: ['earning','deduction','contribution','tax'] },
  calculationMethod: { type: 'string' as const, required: true, enum: ['fixed','percentage','formula','hours_based'] },
  value: { type: 'number' as const },
  priority: { type: 'number' as const },
}

// El período identifica la liquidación y es la clave de unicidad por hotel (ver usecases/runs.ts).
// Sin patrón, un cliente podía mandar `2026-09-1783750850` (epoch pegado al mes) para esquivar esa
// unicidad y crear liquidaciones duplicadas del mismo mes: hay 2 filas así en producción.
// Las fechas van con patrón por el mismo motivo — se muestran crudas en la UI y en los recibos.
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export const CreateRunSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  period: { type: 'string' as const, required: true, pattern: PERIOD_PATTERN, message: 'period debe tener formato YYYY-MM' },
  startDate: { type: 'string' as const, required: true, pattern: DATE_PATTERN, message: 'startDate debe tener formato YYYY-MM-DD' },
  endDate: { type: 'string' as const, required: true, pattern: DATE_PATTERN, message: 'endDate debe tener formato YYYY-MM-DD' },
  paymentDate: { type: 'string' as const, required: true, pattern: DATE_PATTERN, message: 'paymentDate debe tener formato YYYY-MM-DD' },
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
  // La frecuencia define cuánto del sueldo mensual se paga por liquidación (ver periodBaseFor).
  paymentFrequency: { type: 'string' as const, enum: ['weekly', 'biweekly', 'monthly'] },
  paymentDay: { type: 'number' as const, min: 1, max: 31 },
  overtimeMultiplier: { type: 'number' as const, min: 1 },
  nightShiftMultiplier: { type: 'number' as const, min: 1 },
  holidayMultiplier: { type: 'number' as const, min: 1 },
  socialSecurityRate: { type: 'number' as const, min: 0, max: 100 },
  healthInsuranceRate: { type: 'number' as const, min: 0, max: 100 },
  minimumWage: { type: 'number' as const, min: 0 },
  maxOvertimeHoursWeekly: { type: 'number' as const, min: 0 },
  provisionType: { type: 'string' as const, max: 40 },
  yearEndBonusEnabled: { type: 'number' as const },
  yearEndBonusMonths: { type: 'number' as const, min: 1, max: 12 },
}
