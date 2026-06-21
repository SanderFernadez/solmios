import type { ValidationRule } from 'arckode-framework'

export const CreateDispositivosSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
    userId: { type: 'string' as const },
    userName: { type: 'string' as const },
    device: { type: 'string' as const },
    icon: { type: 'string' as const },
    browser: { type: 'string' as const },
    os: { type: 'string' as const },
  ip: { type: 'string' as const },
    isMobile: { type: 'number' as const },
    lastActivity: { type: 'string' as const },
}

export const UpdateDispositivosSchema: Record<string, ValidationRule> = {
    userId: { type: 'string' as const },
    userName: { type: 'string' as const },
    device: { type: 'string' as const },
    icon: { type: 'string' as const },
    browser: { type: 'string' as const },
    os: { type: 'string' as const },
  ip: { type: 'string' as const },
    isMobile: { type: 'number' as const },
    lastActivity: { type: 'string' as const },
}

export const DispositivosValidator = { create: CreateDispositivosSchema, update: UpdateDispositivosSchema }
