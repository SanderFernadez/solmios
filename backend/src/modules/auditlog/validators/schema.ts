import type { ValidationRule } from 'arckode-framework'

export const CreateAuditlogSchema: Record<string, ValidationRule> = {
    action: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const },
    userId: { type: 'string' as const },
    userName: { type: 'string' as const },
    entity: { type: 'string' as const },
    entityId: { type: 'string' as const },
    detail: { type: 'text' as any },
  ip: { type: 'string' as const },
}

export const UpdateAuditlogSchema: Record<string, ValidationRule> = {
    action: { type: 'string' as const },
    userId: { type: 'string' as const },
    userName: { type: 'string' as const },
    entity: { type: 'string' as const },
    entityId: { type: 'string' as const },
    detail: { type: 'text' as any },
  ip: { type: 'string' as const },
}

export const AuditlogValidator = { create: CreateAuditlogSchema, update: UpdateAuditlogSchema }
