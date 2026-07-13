// connectors/attendance-dashboard.ts — Conector attendance→empleados (dashboard).
//
// El panel de RRHH mostraba la ocupación desde las licencias, pero no el fichaje real del día
// (presentes/ausentes/tarde). Empleados no puede importar attendance, así que expone el puerto
// `setAttendancePort` y este connector se lo cablea con el resumen de hoy. Cierra el #198.
//
// `attendance_records.employeeId` ES `employee_profiles.id` (misma clave de join que payroll).

import type { ConnectorContext } from 'arckode-framework'

interface AttendanceModule {
  getTodaySummary(hotelId: string): Promise<{ present: number; late: number }>
}
interface EmpleadosModule {
  setAttendancePort(port: { getTodaySummary(hotelId: string): Promise<{ present: number; late: number }> }): void
}

export function attendanceDashboardConnector(ctx: ConnectorContext): void {
  const empleados = ctx.resolveModule<EmpleadosModule>('empleados')
  empleados.setAttendancePort({
    getTodaySummary: (hotelId) => ctx.resolveModule<AttendanceModule>('attendance').getTodaySummary(hotelId),
  })
}
