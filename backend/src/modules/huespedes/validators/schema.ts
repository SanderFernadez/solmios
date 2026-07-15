// huespedes/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateHuespedesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, required: true, min: 2, max: 200 },
  hotelId: { type: 'string' as const, required: true },
  email: { type: 'string' as const },
    phone: { type: 'string' as const },
    document: { type: 'string' as const },
    nationality: { type: 'string' as const },
    language: { type: 'string' as const },
    sex: { type: 'string' as const },
    country: { type: 'string' as const },
    address: { type: 'string' as const },
    city: { type: 'string' as const },
    province: { type: 'string' as const },
    documentType: { type: 'string' as const },
    documentIssueDate: { type: 'string' as const },
    profession: { type: 'string' as const },
    emergencyContact: { type: 'json' as any },
    preferences: { type: 'json' as any },
    // loyaltyPoints/totalStays/totalSpent/tier NO son editables por API: son derivados del ledger
    // `loyalty_transactions` y la lógica del CRM (nextTier/pointsForStay). Aceptarlos acá permitía
    // ponerse tier "platinum" y puntos arbitrarios saltándose el ledger. El modelo los mantiene con
    // sus defaults; el CRM los actualiza por su vía. (Quitar `tier` además evita el 500 por CHECK.)
    birthDate: { type: 'string' as const },
    notes: { type: 'text' as any },
    active: { type: 'number' as const },
}

export const UpdateHuespedesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, min: 2, max: 200 },
  email: { type: 'string' as const },
    phone: { type: 'string' as const },
    document: { type: 'string' as const },
    nationality: { type: 'string' as const },
    language: { type: 'string' as const },
    sex: { type: 'string' as const },
    country: { type: 'string' as const },
    address: { type: 'string' as const },
    city: { type: 'string' as const },
    province: { type: 'string' as const },
    documentType: { type: 'string' as const },
    documentIssueDate: { type: 'string' as const },
    profession: { type: 'string' as const },
    emergencyContact: { type: 'json' as any },
    preferences: { type: 'json' as any },
    // loyaltyPoints/totalStays/totalSpent/tier NO son editables por API: son derivados del ledger
    // `loyalty_transactions` y la lógica del CRM (nextTier/pointsForStay). Aceptarlos acá permitía
    // ponerse tier "platinum" y puntos arbitrarios saltándose el ledger. El modelo los mantiene con
    // sus defaults; el CRM los actualiza por su vía. (Quitar `tier` además evita el 500 por CHECK.)
    birthDate: { type: 'string' as const },
    notes: { type: 'text' as any },
    active: { type: 'number' as const },
}

export const HuespedesValidator = {
  create: CreateHuespedesSchema,
  update: UpdateHuespedesSchema,
}
