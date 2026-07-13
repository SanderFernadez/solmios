// attendance/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

const GEOLOCATION_RADIUS_MAX = 1000 // metros — límite máximo para geofencing

export const CreateScheduleSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 60 },
  startTime: { type: 'string' as const, required: true },
  endTime: { type: 'string' as const, required: true },
  breakMinutes: { type: 'number' as const, min: 0 },
  graceMinutes: { type: 'number' as const, min: 0 },
}

export const ManualRecordSchema: Record<string, ValidationRule> = {
  employeeId: { type: 'string' as const, required: true },
  clockIn: { type: 'string' as const, required: true },
  clockOut: { type: 'string' as const },
  notes: { type: 'string' as const, max: 500 },
}

export const ClockInSchema: Record<string, ValidationRule> = {
  employeeId: { type: 'string' as const },
  method: { type: 'string' as const, enum: ['manual', 'fingerprint', 'facial', 'pin'] },
}

export const ClockOutSchema: Record<string, ValidationRule> = {
  employeeId: { type: 'string' as const },
}

export const BiometricRecordSchema: Record<string, ValidationRule> = {
  type: { type: 'string' as const, required: true, enum: ['clock_in', 'clock_out'] },
  employeeId: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const },
}

export const CreateShiftAssignmentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  scheduleId: { type: 'string' as const, required: true },
  date: { type: 'string' as const, required: true, min: 8, max: 10 },
  notes: { type: 'string' as const, max: 500 },
}

// Los nombres DEBEN coincidir con los fields de `AttendanceConfigModel` (model.ts).
// El ORM descarta silenciosamente cualquier key no declarada y `validateSchema` es
// whitelist: nombres desalineados = update no-op. Booleanos van como number (0/1).
export const UpdateConfigSchema: Record<string, ValidationRule> = {
  defaultScheduleId: { type: 'string' as const },
  requirePhotoOnClockIn: { type: 'number' as const },
  requireLocationOnClockIn: { type: 'number' as const },
  geoFenceRadiusMeters: { type: 'number' as const, min: 10, max: GEOLOCATION_RADIUS_MAX },
  allowMobileClockIn: { type: 'number' as const },
  autoClockOut: { type: 'number' as const },
  autoClockOutTime: { type: 'string' as const, min: 4, max: 5 },
  overtimeEnabled: { type: 'number' as const },
  overtimeMultiplier: { type: 'number' as const },
  weeklyHoursLimit: { type: 'number' as const },
}
