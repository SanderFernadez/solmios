import type { ValidationRule } from 'arckode-framework'

export const CreateRolesSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, required: true, min: 2, max: 100 },
  icon: { type: 'string' as const, max: 10 },
  color: { type: 'string' as const, max: 20 },
  hotelId: { type: 'string' as const },
  permissions: { type: 'array' as any },
}

export const UpdateRolesSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 100 },
  icon: { type: 'string' as const, max: 10 },
  color: { type: 'string' as const, max: 20 },
  permissions: { type: 'array' as any },
}

export const RolesValidator = { create: CreateRolesSchema, update: UpdateRolesSchema }
