// attendance/types.ts — DTOs

export interface AttendanceRecordDTO {
  id: string; employeeId: string; hotelId: string
  date: string; clockIn: string | null; clockOut: string | null
  breakStart: string | null; breakEnd: string | null
  totalHours: number | null; overtimeHours: number
  status: string; method: string
  location: string | null; notes: string | null; approvedBy: string | null
  createdAt: string; updatedAt: string
}

export interface CreateAttendanceRecordDTO {
  hotelId: string; employeeId: string
  method?: string; notes?: string; location?: string
}

export interface AttendanceScheduleDTO {
  id: string; hotelId: string; name: string
  startTime: string; endTime: string; breakMinutes: number
  graceMinutes: number; overtimeThresholdMinutes: number; active: number
}

export interface CreateAttendanceScheduleDTO {
  hotelId: string; name: string
  startTime: string; endTime: string
  breakMinutes?: number; graceMinutes?: number; overtimeThresholdMinutes?: number
}

export interface AttendanceConfigDTO {
  id: string; hotelId: string
  defaultScheduleId: string | null; requirePhotoOnClockIn: number
  requireLocationOnClockIn: number; geoFenceRadiusMeters: number
  allowMobileClockIn: number; autoClockOut: number; autoClockOutTime: string
  overtimeEnabled: number; overtimeMultiplier: number; weeklyHoursLimit: number
}

// ─── Report types for payroll integration ──────────────
export interface AttendanceReport {
  employeeId: string
  daysWorked: number
  hoursWorked: number
  overtimeHours: number
  absences: number
  lateArrivals: number
}

export interface AttendanceQuery {
  hotelId?: string; employeeId?: string
  from?: string; to?: string; status?: string
  page?: number; limit?: number
}
