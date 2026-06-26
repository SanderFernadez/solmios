// marketing/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateAutoMessageSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  title: { type: 'string' as const, required: true, min: 2 },
  color: { type: 'string' as const },
  channel: { type: 'string' as const, enum: ['email','whatsapp','both'] },
  triggerEvent: { type: 'string' as const, required: true, enum: ['on_reservation','pre_checkin','checkin_day','checkout_day','post_checkout'] },
  triggerOffset: { type: 'number' as const },
}

export const CreateTemplateSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2 },
  body: { type: 'string' as const },
  category: { type: 'string' as const, enum: ['general','reservation','checkin','checkout','payment','marketing'] },
}
