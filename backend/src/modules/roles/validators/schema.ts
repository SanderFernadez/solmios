// roles/validators/schema.ts — Validación de entrada
// Schemas planos, sin dependencias externas.

import type { ValidationRule } from 'arckode-framework'

export const CreateRolesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, required: true, min: 2, max: 200 },
    active: { type: 'boolean' as const }
}

export const UpdateRolesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, min: 2, max: 200 },
    active: { type: 'boolean' as const }
}

// Schema compuesto para usar en validación directa
export const RolesValidator = {
  create: CreateRolesSchema,
  update: UpdateRolesSchema,
}
