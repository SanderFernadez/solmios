import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

const CATEGORY_ENUM = ['general', 'plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'structural', 'pest_control', 'carpentry', 'painting', 'electronics']
const PRIORITY_ENUM = ['low', 'medium', 'high', 'urgent']
const STATUS_ENUM = ['open', 'in_progress', 'waiting', 'resolved', 'closed']
export const PHOTO_TYPE_ENUM = ['before', 'after', 'during']
const NOTES_MAX_LENGTH = 2000

export const CreateMantenimientoSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  title: { type: 'string' as const, required: true, min: 2, max: 200 },
  roomId: { type: 'string' as const },
  roomNumber: { type: 'string' as const, max: 20 },
  description: { type: 'string' as const, max: NOTES_MAX_LENGTH },
  category: { type: 'string' as const, enum: CATEGORY_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  assignedTo: { type: 'string' as const, max: 100 },
  estimatedCost: { type: 'number' as const, min: 0 },
  reportedDate: { type: 'string' as const },
  resolvedDate: { type: 'string' as const },
  // Sin las fotos no se sabe qué hay que arreglar. `reportedBy` NO se acepta del
  // cliente: lo pone el service desde el token.
  photos: { type: 'array' as const },
}

export const UpdateMantenimientoSchema: Record<string, ValidationRule> = {
  title: { type: 'string' as const, min: 2, max: 200 },
  roomId: { type: 'string' as const },
  roomNumber: { type: 'string' as const, max: 20 },
  description: { type: 'string' as const, max: NOTES_MAX_LENGTH },
  category: { type: 'string' as const, enum: CATEGORY_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  assignedTo: { type: 'string' as const, max: 100 },
  estimatedCost: { type: 'number' as const, min: 0 },
  reportedDate: { type: 'string' as const },
  resolvedDate: { type: 'string' as const },
}

// Notes dedicado: reemplaza el check inline `if (!notes)` del controller.
// Mismo límite que el campo notes en CreateMantenimientoSchema — un solo techo por campo.
export const AddNotesSchema: Record<string, ValidationRule> = {
  notes: { type: 'string' as const, required: true, min: 1, max: NOTES_MAX_LENGTH },
}

export const MantenimientoValidator = { create: CreateMantenimientoSchema, update: UpdateMantenimientoSchema }

export const CompleteMantenimientoSchema: Record<string, ValidationRule> = {
  notes: { type: 'string' as const, max: 2000 },
}

export const AddPhotoMantenimientoSchema: Record<string, ValidationRule> = {
  type: { type: 'string' as const, enum: PHOTO_TYPE_ENUM },
}
