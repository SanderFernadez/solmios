// activos/validators/schema.ts — Validación de entrada.
import type { ValidationRule } from 'arckode-framework'

export const CreateActivosSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 120 },
  category: { type: 'string' as const, enum: ['uniform', 'key', 'equipment', 'device', 'other'] },
  serialNumber: { type: 'string' as const, max: 100 },
  notes: { type: 'string' as const, max: 500 },
}

export const UpdateActivosSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 120 },
  category: { type: 'string' as const, enum: ['uniform', 'key', 'equipment', 'device', 'other'] },
  serialNumber: { type: 'string' as const, max: 100 },
  notes: { type: 'string' as const, max: 500 },
  status: { type: 'string' as const, enum: ['available', 'assigned', 'retired'] },
}

export const AssignAssetSchema: Record<string, ValidationRule> = {
  employeeId: { type: 'string' as const, required: true },
}

export const ActivosValidator = { create: CreateActivosSchema, update: UpdateActivosSchema }
