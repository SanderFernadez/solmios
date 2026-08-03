// cancellation/validators/schema.ts — Validación de entrada (F3 cablea los schemas
// en POST/PUT). Schemas planos, sin dependencias externas.
//
// ⚠ validateSchema del framework SOLO maneja string/number/boolean/date → DESCARTA los
// campos array/object (tiers). Mismo patrón que admin/validators (features/modules/limits):
// acá validamos los primitivos (scope/name/priority/scopeId) y `tiers` (array de Tier) se
// reinyecta del body crudo en el controller + se valida a fondo en el usecase
// (validateTiers: deadlineHours>=0, penaltyPercent 0-100, refundable boolean).

import type { ValidationRule } from 'arckode-framework'

export const CreateCancellationPolicySchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  scope: { type: 'string' as const, required: true },
  scopeId: { type: 'string' as const },
  name: { type: 'string' as const, max: 200 },
  priority: { type: 'number' as const },
  active: { type: 'boolean' as const },
}

export const UpdateCancellationPolicySchema: Record<string, ValidationRule> = {
  scope: { type: 'string' as const },
  scopeId: { type: 'string' as const },
  name: { type: 'string' as const, max: 200 },
  priority: { type: 'number' as const },
  active: { type: 'boolean' as const },
}

/**
 * PUT /api/cancellation-policies/base — body: { tiers: Tier[], name? }.
 * `scope` y `scopeId` los fija el backend (base), no vienen del body.
 */
export const UpsertBasePolicySchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, max: 200 },
}

/**
 * POST /api/cancellation-policies/override — body: { scope, scopeId, tiers, name?, priority? }.
 * `tiers` se valida en el usecase (validateTiers); acá solo los primitivos.
 */
export const UpsertOverridePolicySchema: Record<string, ValidationRule> = {
  scope: { type: 'string' as const, required: true },
  scopeId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, max: 200 },
  priority: { type: 'number' as const },
}

export const CancellationValidator = {
  create: CreateCancellationPolicySchema,
  update: UpdateCancellationPolicySchema,
  upsertBase: UpsertBasePolicySchema,
  upsertOverride: UpsertOverridePolicySchema,
}
