// reclutamiento/validators/schema.ts — Validación de entrada.

import type { ValidationRule } from 'arckode-framework'

export const CreateReclutamientoSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 120 },
  jobPositionId: { type: 'string' as const },
  email: { type: 'string' as const, max: 120 },
  phone: { type: 'string' as const, max: 30 },
  source: { type: 'string' as const, max: 40 },
  rating: { type: 'number' as const, min: 0, max: 5 },
  cvUrl: { type: 'string' as const, max: 400 },
  notes: { type: 'string' as const, max: 1000 },
}

export const UpdateReclutamientoSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 120 },
  jobPositionId: { type: 'string' as const },
  email: { type: 'string' as const, max: 120 },
  phone: { type: 'string' as const, max: 30 },
  source: { type: 'string' as const, max: 40 },
  stage: { type: 'string' as const, enum: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
  rating: { type: 'number' as const, min: 0, max: 5 },
  cvUrl: { type: 'string' as const, max: 400 },
  notes: { type: 'string' as const, max: 1000 },
}

// Cambiar de etapa en el pipeline.
export const MoveStageSchema: Record<string, ValidationRule> = {
  stage: { type: 'string' as const, required: true, enum: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
}

// Rechazar requiere motivo (consistente con el resto del sistema).
export const RejectApplicantSchema: Record<string, ValidationRule> = {
  reason: { type: 'string' as const, required: true, min: 3, max: 500 },
}

export const ReclutamientoValidator = {
  create: CreateReclutamientoSchema,
  update: UpdateReclutamientoSchema,
}
