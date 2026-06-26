// ai-gerente/validators/schema.ts — Validación de entrada
// Schemas planos, sin dependencias externas.

import type { ValidationRule } from 'arckode-framework'

export const CreateAiGerenteSchema: Record<string, ValidationRule> = {
  nombre: { type: 'string' as const, required: true, min: 2, max: 200 },
  activo: { type: 'boolean' as const }
}

export const UpdateAiGerenteSchema: Record<string, ValidationRule> = {
  nombre: { type: 'string' as const, min: 2, max: 200 },
  activo: { type: 'boolean' as const }
}

// Schema compuesto para usar en validación directa
export const AiGerenteValidator = {
  create: CreateAiGerenteSchema,
  update: UpdateAiGerenteSchema,
}
