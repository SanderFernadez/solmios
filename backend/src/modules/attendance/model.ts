// attendance/model.ts — 3 tablas de asistencia
import type { ModelDefinition, ORM } from 'arckode-framework'

const AttendanceRecordModel: ModelDefinition = {
  table: 'attendance_records',
  fields: {
    employeeId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    date: { type: 'string', required: true },
    clockIn: { type: 'string' },
    clockOut: { type: 'string' },
    breakStart: { type: 'string' },
    breakEnd: { type: 'string' },
    totalHours: { type: 'number' },
    overtimeHours: { type: 'number', default: 0 },
    status: { type: 'string', required: true, default: 'present' },
    method: { type: 'string', required: true, default: 'pin' },
    location: { type: 'string' },
    notes: { type: 'string' },
    approvedBy: { type: 'string' },
  },
  timestamps: true,
}

const AttendanceScheduleModel: ModelDefinition = {
  table: 'attendance_schedules',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    startTime: { type: 'string', required: true },
    endTime: { type: 'string', required: true },
    breakMinutes: { type: 'number', default: 60 },
    graceMinutes: { type: 'number', default: 15 },
    overtimeThresholdMinutes: { type: 'number', default: 0 },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

const AttendanceConfigModel: ModelDefinition = {
  table: 'attendance_config',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    defaultScheduleId: { type: 'string' },
    requirePhotoOnClockIn: { type: 'boolean', default: 0 },
    requireLocationOnClockIn: { type: 'boolean', default: 0 },
    geoFenceRadiusMeters: { type: 'number', default: 100 },
    allowMobileClockIn: { type: 'boolean', default: 1 },
    autoClockOut: { type: 'boolean', default: 1 },
    autoClockOutTime: { type: 'string', default: '23:59' },
    overtimeEnabled: { type: 'boolean', default: 1 },
    overtimeMultiplier: { type: 'number', default: 1.5 },
    weeklyHoursLimit: { type: 'number', default: 48 },
  },
  timestamps: true,
}

export function registerAttendanceModels(orm: ORM): void {
  orm.define('AttendanceRecord', AttendanceRecordModel)
  orm.define('AttendanceSchedule', AttendanceScheduleModel)
  orm.define('AttendanceConfig', AttendanceConfigModel)
}
