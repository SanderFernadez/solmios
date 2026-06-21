import type { ValidationRule } from 'arckode-framework'

export const CreateOpinionesSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    rating: { type: 'number' as const, required: true },
    guestId: { type: 'string' as const },
    reservationId: { type: 'string' as const },
    title: { type: 'string' as const },
    comment: { type: 'text' as any },
    response: { type: 'text' as any },
  date: { type: 'string' as const },
  visible: { type: 'number' as const },
    channel: { type: 'string' as const },
}

export const UpdateOpinionesSchema: Record<string, ValidationRule> = {
    rating: { type: 'number' as const },
    title: { type: 'string' as const },
    comment: { type: 'text' as any },
    response: { type: 'text' as any },
  visible: { type: 'number' as const },
    channel: { type: 'string' as const },
}

export const OpinionesValidator = { create: CreateOpinionesSchema, update: UpdateOpinionesSchema }
