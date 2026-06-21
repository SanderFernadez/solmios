import type { ValidationRule } from 'arckode-framework'

const CATEGORY_ENUM = ['technical', 'billing', 'reservation', 'housekeeping', 'maintenance', 'general']
const PRIORITY_ENUM = ['low', 'medium', 'high', 'urgent']
const STATUS_ENUM = ['open', 'in_progress', 'resolved', 'closed']

export const CreateTicketsSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  userId: { type: 'string' as const, required: true },
  subject: { type: 'string' as const, required: true, min: 2, max: 200 },
  category: { type: 'string' as const, enum: CATEGORY_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  description: { type: 'string' as const, max: 5000 },
  assignedTo: { type: 'string' as const, max: 100 },
  messages: { type: 'array' as any },
}

export const UpdateTicketsSchema: Record<string, ValidationRule> = {
  subject: { type: 'string' as const, min: 2, max: 200 },
  category: { type: 'string' as const, enum: CATEGORY_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  description: { type: 'string' as const, max: 5000 },
  assignedTo: { type: 'string' as const, max: 100 },
  messages: { type: 'array' as any },
}

export const TicketsValidator = { create: CreateTicketsSchema, update: UpdateTicketsSchema }
