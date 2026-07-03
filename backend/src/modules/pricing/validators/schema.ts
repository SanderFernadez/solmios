import type { ValidationRule } from 'arckode-framework'

const arrayType = 'array' as any

export const CreateBlockSchema: Record<string, ValidationRule> = {
  roomIds: { type: arrayType, required: true },
  reason: { type: 'string' as const, max: 200 },
  startDate: { type: 'string' as const, required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  endDate: { type: 'string' as const, required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
}

export const UpdateSeasonsSchema: Record<string, ValidationRule> = {
  seasons: { type: arrayType, required: true },
}

export const UpdateRatesSchema: Record<string, ValidationRule> = {
  rates: { type: arrayType, required: true },
}

export const UpdateRateRestrictionsSchema: Record<string, ValidationRule> = {
  restrictions: { type: arrayType, required: true },
}

export const PricingValidator = {
  createBlock: CreateBlockSchema,
  updateSeasons: UpdateSeasonsSchema,
  updateRates: UpdateRatesSchema,
  updateRateRestrictions: UpdateRateRestrictionsSchema,
}
