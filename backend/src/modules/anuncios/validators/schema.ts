import type { ValidationRule } from 'arckode-framework'

const TYPE_ENUM = ['info', 'warning', 'urgent', 'maintenance']
const PRIORITY_ENUM = ['low', 'medium', 'high']
const MAX_MESSAGE_LENGTH = 5000
const MIN_TITLE_LENGTH = 2
const MAX_TITLE_LENGTH = 200

export const CreateAnunciosSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  authorId: { type: 'string' as const },
  title: { type: 'string' as const, required: true, min: MIN_TITLE_LENGTH, max: MAX_TITLE_LENGTH },
  message: { type: 'string' as const, max: MAX_MESSAGE_LENGTH },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  active: { type: 'number' as const },
  date: { type: 'string' as const },
}

export const UpdateAnunciosSchema: Record<string, ValidationRule> = {
  authorId: { type: 'string' as const },
  title: { type: 'string' as const, min: MIN_TITLE_LENGTH, max: MAX_TITLE_LENGTH },
  message: { type: 'string' as const, max: MAX_MESSAGE_LENGTH },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  active: { type: 'number' as const },
  date: { type: 'string' as const },
}

export const AnunciosValidator = { create: CreateAnunciosSchema, update: UpdateAnunciosSchema }
