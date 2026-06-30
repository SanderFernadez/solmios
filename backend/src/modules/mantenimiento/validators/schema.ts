import type { ValidationRule } from 'arckode-framework'

const CATEGORY_ENUM = ['general', 'plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'structural', 'pest_control', 'carpentry', 'painting', 'electronics']
const PRIORITY_ENUM = ['low', 'medium', 'high', 'urgent']
const STATUS_ENUM = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

export const CreateMantenimientoSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  title: { type: 'string' as const, required: true, min: 2, max: 200 },
  roomId: { type: 'string' as const },
  roomNumber: { type: 'string' as const, max: 20 },
  description: { type: 'string' as const, max: 2000 },
  category: { type: 'string' as const, enum: CATEGORY_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  assignedTo: { type: 'string' as const, max: 100 },
  estimatedCost: { type: 'number' as const, min: 0 },
  reportedDate: { type: 'string' as const },
  resolvedDate: { type: 'string' as const },
}

export const UpdateMantenimientoSchema: Record<string, ValidationRule> = {
  title: { type: 'string' as const, min: 2, max: 200 },
  roomId: { type: 'string' as const },
  roomNumber: { type: 'string' as const, max: 20 },
  description: { type: 'string' as const, max: 2000 },
  category: { type: 'string' as const, enum: CATEGORY_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  assignedTo: { type: 'string' as const, max: 100 },
  estimatedCost: { type: 'number' as const, min: 0 },
  reportedDate: { type: 'string' as const },
  resolvedDate: { type: 'string' as const },
}

export const MantenimientoValidator = { create: CreateMantenimientoSchema, update: UpdateMantenimientoSchema }
