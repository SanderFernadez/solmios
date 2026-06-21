// huespedes/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateHuespedesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, required: true, min: 2, max: 200 },
  hotelId: { type: 'string' as const, required: true },
  email: { type: 'string' as const },
    phone: { type: 'string' as const },
    document: { type: 'string' as const },
    nationality: { type: 'string' as const },
    preferences: { type: 'json' as any },
    totalStays: { type: 'number' as const },
    totalSpent: { type: 'number' as const },
  tier: { type: 'string' as const },
    notes: { type: 'text' as any },
    active: { type: 'number' as const },
}

export const UpdateHuespedesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, min: 2, max: 200 },
  email: { type: 'string' as const },
    phone: { type: 'string' as const },
    document: { type: 'string' as const },
    nationality: { type: 'string' as const },
    preferences: { type: 'json' as any },
    totalStays: { type: 'number' as const },
    totalSpent: { type: 'number' as const },
  tier: { type: 'string' as const },
    notes: { type: 'text' as any },
    active: { type: 'number' as const },
}

export const HuespedesValidator = {
  create: CreateHuespedesSchema,
  update: UpdateHuespedesSchema,
}
