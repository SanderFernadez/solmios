import type { ValidationRule } from 'arckode-framework'

export const CreateApikeysSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  name: { type: 'string' as const, required: true, min: 2, max: 100 },
  scope: { type: 'string' as const, max: 100 },
  masked: { type: 'string' as const, max: 100 },
  secretHash: { type: 'string' as const, max: 200 },
  active: { type: 'number' as const },
  requests: { type: 'number' as const, min: 0 },
  lastUsed: { type: 'string' as const },
}

export const UpdateApikeysSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 100 },
  scope: { type: 'string' as const, max: 100 },
  masked: { type: 'string' as const, max: 100 },
  secretHash: { type: 'string' as const, max: 200 },
  active: { type: 'number' as const },
  requests: { type: 'number' as const, min: 0 },
  lastUsed: { type: 'string' as const },
}

export const ApikeysValidator = { create: CreateApikeysSchema, update: UpdateApikeysSchema }
