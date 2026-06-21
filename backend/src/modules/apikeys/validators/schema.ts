import type { ValidationRule } from 'arckode-framework'

export const CreateApikeysSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const },
  scope: { type: 'string' as const },
  masked: { type: 'string' as const },
  secretHash: { type: 'string' as const },
    active: { type: 'number' as const },
  requests: { type: 'number' as const },
  lastUsed: { type: 'string' as const },
}

export const UpdateApikeysSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const },
  scope: { type: 'string' as const },
  masked: { type: 'string' as const },
  secretHash: { type: 'string' as const },
    active: { type: 'number' as const },
  requests: { type: 'number' as const },
  lastUsed: { type: 'string' as const },
}

export const ApikeysValidator = { create: CreateApikeysSchema, update: UpdateApikeysSchema }
