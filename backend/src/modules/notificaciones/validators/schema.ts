import type { ValidationRule } from 'arckode-framework'

export const CreateNotificacionesSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    title: { type: 'string' as const, required: true },
    userId: { type: 'string' as const },
    type: { type: 'string' as const },
    message: { type: 'text' as any },
    read: { type: 'number' as const },
    sent: { type: 'number' as const },
  date: { type: 'string' as const },
    channel: { type: 'string' as const },
  metadata: { type: 'json' as any },
}

export const UpdateNotificacionesSchema: Record<string, ValidationRule> = {
    title: { type: 'string' as const },
    userId: { type: 'string' as const },
    type: { type: 'string' as const },
    message: { type: 'text' as any },
    read: { type: 'number' as const },
    sent: { type: 'number' as const },
  date: { type: 'string' as const },
    channel: { type: 'string' as const },
  metadata: { type: 'json' as any },
}

export const NotificacionesValidator = { create: CreateNotificacionesSchema, update: UpdateNotificacionesSchema }
