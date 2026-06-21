// canales/validators/schema.ts — Validación de entrada
// Schemas planos, sin dependencias externas.

import type { ValidationRule } from 'arckode-framework'

export const CreateCanalesSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true, min: 1, max: 200 },
  channexPropertyId: { type: 'string' as const, max: 200 },
  syncEnabled: { type: 'number' as const },
}

export const UpdateCanalesSchema: Record<string, ValidationRule> = {
  channexPropertyId: { type: 'string' as const, max: 200 },
  syncEnabled: { type: 'number' as const },
    lastSync: { type: 'string' as const },
}

export const CanalesValidator = {
  create: CreateCanalesSchema,
  update: UpdateCanalesSchema,
}
