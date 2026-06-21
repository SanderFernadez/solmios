import type { ValidationRule } from 'arckode-framework'

export const CreateDispositivosSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  userId: { type: 'string' as const },
  userName: { type: 'string' as const, max: 100 },
  device: { type: 'string' as const, max: 200 },
  icon: { type: 'string' as const, max: 10 },
  browser: { type: 'string' as const, max: 100 },
  os: { type: 'string' as const, max: 100 },
  ip: { type: 'string' as const, max: 45 },
  isMobile: { type: 'number' as const },
  lastActivity: { type: 'string' as const },
}

export const UpdateDispositivosSchema: Record<string, ValidationRule> = {
  userId: { type: 'string' as const },
  userName: { type: 'string' as const, max: 100 },
  device: { type: 'string' as const, max: 200 },
  icon: { type: 'string' as const, max: 10 },
  browser: { type: 'string' as const, max: 100 },
  os: { type: 'string' as const, max: 100 },
  ip: { type: 'string' as const, max: 45 },
  isMobile: { type: 'number' as const },
  lastActivity: { type: 'string' as const },
}

export const DispositivosValidator = { create: CreateDispositivosSchema, update: UpdateDispositivosSchema }
