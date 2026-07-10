import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'
import { MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from '../../../shared/validators/limits'

const TYPE_ENUM = ['full_cleaning', 'quick_cleaning', 'deep_cleaning', 'inspection', 'maintenance']
const PRIORITY_ENUM = ['low', 'medium', 'high', 'urgent']
const STATUS_ENUM = ['pending', 'in_progress', 'completed', 'inspected']

/** A quién le va el reporte. Solo `maintenance` abre un ticket. */
const REPORT_TYPE_ENUM = ['maintenance', 'supervisor']

/** Antes `/report` no validaba nada y la descripción era infinita. */
export const REPORT_DESCRIPTION_MAX = MAX_TEXT_LENGTH

export const ReportIssueSchema: Record<string, ValidationRule> = {
  description: {
    type: 'string' as const,
    required: true,
    min: MIN_TEXT_LENGTH,
    max: MAX_TEXT_LENGTH,
  },
  type: { type: 'string' as const, enum: REPORT_TYPE_ENUM },
}

export const CreateHousekeepingSchema: Record<string, ValidationRule> = {
  roomId: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const, required: true },
  staffId: { type: 'string' as const },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  notes: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  assignedDate: { type: 'string' as const },
  completedDate: { type: 'string' as const },
  cleaningItems: { type: 'array' as const },
  startTime: { type: 'string' as const },
  endTime: { type: 'string' as const },
  photos: { type: 'array' as const },
}

export const UpdateHousekeepingSchema: Record<string, ValidationRule> = {
  roomId: { type: 'string' as const },
  staffId: { type: 'string' as const },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  priority: { type: 'string' as const, enum: PRIORITY_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  notes: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  assignedDate: { type: 'string' as const },
  completedDate: { type: 'string' as const },
  cleaningItems: { type: 'array' as const },
  // Timings + fotos gestionados principalmente vía endpoints dedicados (start/complete/photos),
  // pero se permiten en update para que el panel admin pueda corregirlos manualmente.
  startTime: { type: 'string' as const },
  endTime: { type: 'string' as const },
  photos: { type: 'array' as const },
}

export const HousekeepingValidator = { create: CreateHousekeepingSchema, update: UpdateHousekeepingSchema }

export const UploadPhotoSchema: Record<string, ValidationRule> = {
  photo: { type: 'string' as const, required: true },
  fileName: { type: 'string' as const },
}

export const RemovePhotoSchema: Record<string, ValidationRule> = {
  url: { type: 'string' as const, required: true },
}
