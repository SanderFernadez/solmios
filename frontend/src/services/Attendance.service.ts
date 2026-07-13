// services/Attendance.service.ts
import { http } from './http'

export interface AttendanceRecord {
  id: string; employeeId: string; hotelId: string; date: string
  clockIn: string | null; clockOut: string | null
  breakStart: string | null; breakEnd: string | null
  totalHours: number | null; overtimeHours: number
  status: string; method: string; notes: string | null
}

export interface AttendanceSchedule {
  id: string; hotelId: string; name: string
  startTime: string; endTime: string; breakMinutes: number
  graceMinutes: number; overtimeThresholdMinutes: number
}

/** Fila agregada por empleado que devuelve /api/attendance/report (para la nómina). */
export interface AttendanceReportRow {
  employeeId: string; daysWorked: number; hoursWorked: number
  overtimeHours: number; absences: number; lateArrivals: number
}

export interface AttendanceConfig {
  id: string; hotelId: string; autoClockOut: number; autoClockOutTime: string
  overtimeEnabled: number; overtimeMultiplier: number; allowMobileClockIn: number
  weeklyHoursLimit: number; defaultScheduleId?: string
  requirePhotoOnClockIn: number; requireLocationOnClockIn: number; geoFenceRadiusMeters: number
}

export interface ShiftAssignment {
  id: string; hotelId: string; employeeId: string
  scheduleId: string; date: string; notes: string | null
}

export const AttendanceService = {
  // Calendario de turnos
  listShiftAssignments: (from: string, to: string): Promise<ShiftAssignment[]> => http.get(`/api/attendance/shift-assignments?from=${from}&to=${to}`),
  assignShift: (data: { employeeId: string; scheduleId: string; date: string }): Promise<ShiftAssignment> => http.post('/api/attendance/shift-assignments', data),
  removeShiftAssignment: (id: string): Promise<void> => http.delete(`/api/attendance/shift-assignments/${id}`),

  clockIn: (employeeId: string, method?: string) => http.post('/api/attendance/clock-in', { employeeId, method }) as Promise<AttendanceRecord>,
  clockOut: (employeeId: string) => http.post('/api/attendance/clock-out', { employeeId }) as Promise<AttendanceRecord>,
  startBreak: (employeeId: string) => http.post('/api/attendance/break/start', { employeeId }) as Promise<AttendanceRecord>,
  endBreak: (employeeId: string) => http.post('/api/attendance/break/end', { employeeId }) as Promise<AttendanceRecord>,
  manualRecord: (data: { employeeId: string; clockIn: string; clockOut?: string; notes?: string }) => http.post('/api/attendance/manual', data) as Promise<AttendanceRecord>,
  getToday: (employeeId: string): Promise<AttendanceRecord | null> => http.get(`/api/attendance/today/${employeeId}`),
  listRecords: (params?: Record<string, string>): Promise<AttendanceRecord[]> => { const qs = params ? '?' + new URLSearchParams(params).toString() : ''; return http.get(`/api/attendance/records${qs}`) },
  getReport: (from: string, to: string): Promise<AttendanceReportRow[]> => http.get(`/api/attendance/report?from=${from}&to=${to}`),

  listSchedules: (): Promise<AttendanceSchedule[]> => http.get('/api/attendance/schedules'),
  createSchedule: (data: Partial<AttendanceSchedule>): Promise<AttendanceSchedule> => http.post('/api/attendance/schedules', data),
  deleteSchedule: (id: string): Promise<void> => http.delete(`/api/attendance/schedules/${id}`),

  getConfig: (): Promise<AttendanceConfig> => http.get('/api/attendance/config'),
  updateConfig: (data: Partial<AttendanceConfig>): Promise<AttendanceConfig> => http.put('/api/attendance/config', data),
}
