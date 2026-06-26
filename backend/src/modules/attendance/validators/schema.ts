// attendance/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateScheduleSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2 },
  startTime: { type: 'string' as const, required: true },
  endTime: { type: 'string' as const, required: true },
  breakMinutes: { type: 'number' as const, min: 0 },
  graceMinutes: { type: 'number' as const, min: 0 },
}

export const ManualRecordSchema: Record<string, ValidationRule> = {
  employeeId: { type: 'string' as const, required: true },
  clockIn: { type: 'string' as const, required: true },
  clockOut: { type: 'string' as const },
  notes: { type: 'string' as const },
}
