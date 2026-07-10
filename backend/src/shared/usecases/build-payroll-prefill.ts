// shared/usecases/build-payroll-prefill.ts — Arma el prellenado de una liquidación desde los fichajes.
//
// Hasta ahora la nómina se cargaba a mano: la pantalla pedía salario, días y horas por `window.prompt`
// y nadie leía `attendance_records`. Esto cruza el legajo (salario) con el reporte de asistencia
// (horas fichadas) para que el contador arranque con datos reales y sólo corrija.
//
// Es PRELLENADO, no cálculo: el resultado va a una tabla editable, no directo al motor.

import type { PayrollEmployeeRef, AttendanceReportInput, PayrollPrefillRow } from '../../modules/payroll/types'

/**
 * Left join sobre los empleados activos: TODO empleado produce una fila.
 *
 * - La lista base son los empleados, no los fichajes: alguien que trabajó y no fichó no puede
 *   desaparecer de la nómina. Aparece en cero, con `hasAttendance: false`, para que se lo revise.
 * - Un `employeeId` que está en los fichajes pero NO tiene legajo activo (perfil borrado) se ignora:
 *   sin salario no es liquidable. `orphanFichajes` los devuelve para poder loguearlos.
 */
export function buildPayrollPrefill(
  employees: PayrollEmployeeRef[],
  report: AttendanceReportInput[],
): { rows: PayrollPrefillRow[]; orphanFichajes: string[] } {
  const byEmployee = new Map(report.map((r) => [r.employeeId, r]))

  const rows: PayrollPrefillRow[] = employees.map((emp) => {
    const hours = byEmployee.get(emp.employeeId)
    return {
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      baseSalary: emp.baseSalary,
      daysWorked: hours?.daysWorked ?? 0,
      hoursWorked: hours?.hoursWorked ?? 0,
      overtimeHours: hours?.overtimeHours ?? 0,
      absences: hours?.absences ?? 0,
      lateArrivals: hours?.lateArrivals ?? 0,
      hasAttendance: !!hours,
    }
  })

  const known = new Set(employees.map((e) => e.employeeId))
  const orphanFichajes = report.map((r) => r.employeeId).filter((id) => !known.has(id))

  return { rows, orphanFichajes }
}
