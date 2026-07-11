// capacitacion/validators/schema.ts — Validación de entrada.
import type { ValidationRule } from 'arckode-framework'

export const CreateCourseSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 150 },
  type: { type: 'string' as const, enum: ['course', 'certification', 'onboarding'] },
  description: { type: 'string' as const, max: 1000 },
  materialUrl: { type: 'string' as const, max: 500 },
  durationHours: { type: 'number' as const, min: 0 },
  validityMonths: { type: 'number' as const, min: 0 },
}

export const UpdateCourseSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 150 },
  type: { type: 'string' as const, enum: ['course', 'certification', 'onboarding'] },
  description: { type: 'string' as const, max: 1000 },
  materialUrl: { type: 'string' as const, max: 500 },
  durationHours: { type: 'number' as const, min: 0 },
  validityMonths: { type: 'number' as const, min: 0 },
  active: { type: 'number' as const },
}

export const EnrollSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  courseId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  notes: { type: 'string' as const, max: 500 },
}

export const CompleteEnrollmentSchema: Record<string, ValidationRule> = {
  score: { type: 'number' as const, min: 0, max: 100 },
}

// Aliases que el scaffold espera (index.ts los re-exporta).
export const CreateCapacitacionSchema = CreateCourseSchema
export const UpdateCapacitacionSchema = UpdateCourseSchema
export const CapacitacionValidator = { create: CreateCourseSchema, update: UpdateCourseSchema }
