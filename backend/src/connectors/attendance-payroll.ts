// connectors/attendance-payroll.ts — Wire: payroll ← attendance + empleados
//
// La nómina se cargaba a mano (window.prompt en la UI). Payroll no puede importar de otros módulos,
// así que declara el puerto `PayrollPrefillPort` y este connector se lo cablea: el salario sale del
// legajo (empleados) y las horas del reporte de asistencia.
//
// `attendance_records.employeeId` ES `employee_profiles.id`, así que la clave de join coincide.
// (Ojo: housekeeping y mantenimiento usan `users.id`, no ésta — no confundir.)

import type { ConnectorContext } from 'arckode-framework'
import type {
  PayrollPrefillPort, PayrollEmployeeRef, AttendanceReportInput,
} from '../modules/payroll'
import type { AttendanceReport } from '../modules/attendance'
import type { EmployeeProfileDTO, EmpleadosPaginated } from '../modules/empleados'

const PAGE_SIZE = 200

export function attendancePayrollConnector(ctx: ConnectorContext): void {
  const payroll = ctx.resolveModule<{ setPrefillPort: (p: PayrollPrefillPort) => void }>('payroll')
  const attendance = ctx.resolveModule<{ getReport: (h: string, f: string, t: string) => Promise<AttendanceReport[]> }>('attendance')
  const empleados = ctx.resolveModule<{ listProfiles: (q: { hotelId: string; active: boolean; page: number; limit: number }) => Promise<EmpleadosPaginated> }>('empleados')

  payroll.setPrefillPort({
    // Passthrough: AttendanceReport es estructuralmente AttendanceReportInput.
    getReport: (hotelId, from, to): Promise<AttendanceReportInput[]> => attendance.getReport(hotelId, from, to),

    // Pagina hasta agotar el total. Un `limit` mágico dejaría empleados afuera en un hotel grande,
    // y "faltó un empleado en la nómina" es un bug que nadie quiere descubrir en el recibo.
    listEmployees: async (hotelId): Promise<PayrollEmployeeRef[]> => {
      const refs: PayrollEmployeeRef[] = []
      for (let page = 1; ; page++) {
        const { data, total } = await empleados.listProfiles({ hotelId, active: true, page, limit: PAGE_SIZE })
        for (const p of data as Array<EmployeeProfileDTO & { userName?: string }>) {
          refs.push({
            employeeId: p.id,
            employeeName: p.userName ?? p.id,
            baseSalary: Number(p.salary) || 0,
          })
        }
        if (refs.length >= total || data.length === 0) break
      }
      return refs
    },
  })
}
