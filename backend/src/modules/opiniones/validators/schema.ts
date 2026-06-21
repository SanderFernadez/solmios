import type { ValidationRule } from 'arckode-framework'

const CHANNEL_ENUM = ['direct', 'booking', 'airbnb', 'expedia', 'google', 'other']
const MAX_TITLE_LENGTH = 200
const MAX_TEXT_LENGTH = 5000
const RATING_MIN = 1
const RATING_MAX = 5

export const CreateOpinionesSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  guestId: { type: 'string' as const },
  reservationId: { type: 'string' as const },
  rating: { type: 'number' as const, required: true, min: RATING_MIN, max: RATING_MAX },
  title: { type: 'string' as const, max: MAX_TITLE_LENGTH },
  comment: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  response: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  date: { type: 'string' as const },
  visible: { type: 'number' as const },
  channel: { type: 'string' as const, enum: CHANNEL_ENUM },
}

export const UpdateOpinionesSchema: Record<string, ValidationRule> = {
  guestId: { type: 'string' as const },
  reservationId: { type: 'string' as const },
  rating: { type: 'number' as const, min: RATING_MIN, max: RATING_MAX },
  title: { type: 'string' as const, max: MAX_TITLE_LENGTH },
  comment: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  response: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  date: { type: 'string' as const },
  visible: { type: 'number' as const },
  channel: { type: 'string' as const, enum: CHANNEL_ENUM },
}

export const OpinionesValidator = { create: CreateOpinionesSchema, update: UpdateOpinionesSchema }
