import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// `validateSchema` devuelve SOLO los campos declarados acá: un campo ausente se descarta en
// silencio antes de llegar al service. Mantener sincronizado con model.ts + types.ts.

export const CreateFundSchema: Record<string, ValidationRule> = {
  // hotelId opcional en el body: el service lo fuerza desde el JWT (anti-IDOR).
  hotelId: { type: 'string' as const },
  name: { type: 'string' as const, required: true },
  custodianId: { type: 'string' as const, required: true },
  targetAmount: { type: 'number' as const, required: true, min: 0.01 },
  currency: { type: 'string' as const },
  active: { type: 'number' as const },
  notes: { type: 'text' as const },
}

export const UpdateFundSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  custodianId: { type: 'string' as const },
  targetAmount: { type: 'number' as const, min: 0.01 },
  currency: { type: 'string' as const },
  active: { type: 'number' as const },
  notes: { type: 'text' as const },
}

export const CreateReplenishmentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  fundId: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true, min: 0.01 },
  sourceBankAccountId: { type: 'string' as const },
  notes: { type: 'text' as const },
}

export const CajaChicaValidator = {
  createFund: CreateFundSchema,
  updateFund: UpdateFundSchema,
  createReplenishment: CreateReplenishmentSchema,
}
