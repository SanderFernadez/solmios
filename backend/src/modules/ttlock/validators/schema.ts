import type { ValidationRule } from 'arckode-framework'

export const UpdateTTLockConfigSchema: Record<string, ValidationRule> = {
  clientId: { type: 'string' as const, max: 100 },
  clientSecret: { type: 'string' as const, max: 200 },
  username: { type: 'string' as const, max: 100 },
  password: { type: 'string' as const, max: 200 },
  region: { type: 'string' as const, min: 2, max: 10 },
  accountId: { type: 'string' as const, max: 100 },
}

export const ConnectTTLockSchema: Record<string, ValidationRule> = {
  clientId: { type: 'string' as const, max: 100 },
  clientSecret: { type: 'string' as const, max: 200 },
  username: { type: 'string' as const, max: 100 },
  password: { type: 'string' as const, max: 200 },
  region: { type: 'string' as const, min: 2, max: 10 },
}

export const UpdateLockDeviceSchema: Record<string, ValidationRule> = {
  roomId: { type: 'string' as const },
  name: { type: 'string' as const, max: 100 },
}

export const TTLockValidator = {
  updateConfig: UpdateTTLockConfigSchema,
  connect: ConnectTTLockSchema,
  updateLock: UpdateLockDeviceSchema,
}
