// marketing/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateAutoMessageSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  title: { type: 'string' as const, required: true, min: 2 },
  color: { type: 'string' as const },
  channel: { type: 'string' as const, enum: ['email','whatsapp','both'] },
  triggerEvent: { type: 'string' as const, required: true, enum: ['on_reservation','pre_checkin','checkin_day','checkout_day','post_checkout'] },
  triggerOffset: { type: 'number' as const },
  emailSubject: { type: 'string' as const },
  emailBody: { type: 'string' as const },
  whatsappBody: { type: 'string' as const },
  // Notification templates configurable + i18n (spec 11.1.6).
  event: { type: 'string' as const, enum: ['reservation_confirmed','reservation_presale','checkin_welcome','reminder'] },
  language: { type: 'string' as const, enum: ['es','en','pt'] },
  triggerType: { type: 'string' as const, enum: ['immediate','cron'] },
}

export const CreateTemplateSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2 },
  body: { type: 'string' as const },
  category: { type: 'string' as const, enum: ['general','reservation','checkin','checkout','payment','marketing'] },
}
