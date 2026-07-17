import type { ValidationRule } from 'arckode-framework'

export const UpdateTTLockConfigSchema: Record<string, ValidationRule> = {
  clientId: { type: 'string' as const, max: 100 },
  clientSecret: { type: 'string' as const, max: 200 },
  username: { type: 'string' as const, max: 100 },
  password: { type: 'string' as const, max: 200 },
  region: { type: 'string' as const, min: 2, max: 10 },
  accountId: { type: 'string' as const, max: 100 },
  // Entrega del PIN: 1 bluetooth · 2 gateway · 3 NB-IoT
  addType: { type: 'number' as const, min: 1, max: 3 },
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
  autoCodesEnabled: { type: 'boolean' as const },
}

// Código fijo (permanente) de staff. `code` opcional (si no viene, se genera). 4-9 dígitos.
export const CreatePermanentCodeSchema: Record<string, ValidationRule> = {
  code: { type: 'string' as const, min: 4, max: 9 },
  name: { type: 'string' as const, max: 50 },
}

export const TTLockValidator = {
  updateConfig: UpdateTTLockConfigSchema,
  connect: ConnectTTLockSchema,
  updateLock: UpdateLockDeviceSchema,
  createPermanentCode: CreatePermanentCodeSchema,
}
