import type { ValidationRule } from 'arckode-framework'

const TYPE_ENUM = ['full_cleaning', 'quick_cleaning', 'deep_cleaning', 'inspection', 'maintenance']
const PRIORITY_ENUM = ['low', 'medium', 'high', 'urgent']
const STATUS_ENUM = ['pending', 'in_progress', 'completed', 'inspected']

export const CreateHousekeepingSchema: Record<string, ValidationRule> = {
  roomId: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const, required: true },
  staffId: { type: 'string' as const },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  notes: { type: 'string' as const, max: 2000 },
  assignedDate: { type: 'string' as const },
  completedDate: { type: 'string' as const },
  cleaningItems: { type: 'array' as any },
}

export const UpdateHousekeepingSchema: Record<string, ValidationRule> = {
  roomId: { type: 'string' as const },
  staffId: { type: 'string' as const },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  notes: { type: 'string' as const, max: 2000 },
  assignedDate: { type: 'string' as const },
  completedDate: { type: 'string' as const },
  cleaningItems: { type: 'array' as any },
}

export const HousekeepingValidator = { create: CreateHousekeepingSchema, update: UpdateHousekeepingSchema }
