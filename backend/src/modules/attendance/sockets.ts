// attendance/sockets.ts
import type { AttendanceRecordDTO } from './types'

export interface AttendanceSockets {
  onClockIn?: (record: AttendanceRecordDTO) => Promise<void>
  onClockOut?: (record: AttendanceRecordDTO) => Promise<void>
}

/**
 * Asistencia agregada por empleado para el motor de evaluación de desempeño (#321).
 * `employeeId` es `employee_profiles.id`. Puerto de CONSULTA (no un hook): lo lee el
 * connector `empleados-attendance` vía el service, sin que empleados importe este módulo.
 */
export interface AttendanceStaffStat {
  employeeId: string
  /** Asistencias a tiempo (status 'present'/otros con fichaje, sin 'late'/'absent'). */
  present: number
  absent: number
  late: number
}

export interface AttendanceStatsPort {
  getStaffAttendance(hotelId: string, from: string, to: string): Promise<AttendanceStaffStat[]>
}
