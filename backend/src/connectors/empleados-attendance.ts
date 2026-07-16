// connectors/empleados-attendance.ts — Wire: empleados ← attendance (motor de evaluación #321).
//
// El motor de evaluación (empleados) necesita la puntualidad y la asistencia reales de cada empleado,
// que viven en attendance. Empleados no puede importar attendance, así que expone el puerto
// `setAttendanceStatsPort` y este connector se lo cablea con el agregado por empleado.
//
// `attendance_records.employeeId` ES `employee_profiles.id` — misma clave que usa el motor.
// Solo DELEGA (regla #3): passthrough del método público del service de attendance.

import type { ConnectorContext } from 'arckode-framework'
import type { AttendanceStatsPort } from '../modules/empleados'
import type { AttendanceStatsPort as AttendanceQueryPort } from '../modules/attendance'

export function empleadosAttendanceConnector(ctx: ConnectorContext): void {
  const empleados = ctx.resolveModule<{ setAttendanceStatsPort: (p: AttendanceStatsPort) => void }>('empleados')
  const attendance = ctx.resolveModule<AttendanceQueryPort>('attendance')

  empleados.setAttendanceStatsPort({
    getStaffAttendance: (hotelId, from, to) => attendance.getStaffAttendance(hotelId, from, to),
  })
}
