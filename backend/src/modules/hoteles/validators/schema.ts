import type { ValidationRule } from 'arckode-framework'

export const CreateHotelesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, required: true },
    address: { type: 'string' as const },
    phone: { type: 'string' as const },
  email: { type: 'string' as const },
    country: { type: 'string' as const },
    currency: { type: 'string' as const },
    timezone: { type: 'string' as const },
  plan: { type: 'string' as const },
    status: { type: 'string' as const },
  roomsCount: { type: 'number' as const },
    active: { type: 'number' as const },
}

export const UpdateHotelesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const },
    address: { type: 'string' as const },
    phone: { type: 'string' as const },
  email: { type: 'string' as const },
    country: { type: 'string' as const },
    currency: { type: 'string' as const },
    timezone: { type: 'string' as const },
  plan: { type: 'string' as const },
    status: { type: 'string' as const },
  roomsCount: { type: 'number' as const },
    active: { type: 'number' as const },
}

export const HotelesValidator = { create: CreateHotelesSchema, update: UpdateHotelesSchema }
