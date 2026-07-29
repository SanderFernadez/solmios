// connectors/empleados-capacitacion.ts — Wire: empleados ← capacitacion (motor de evaluación #321, DT-19).
//
// El motor de evaluación necesita los cursos COMPLETADOS por empleado, que viven en capacitacion
// (enrollments). Empleados no puede importar capacitacion, así que expone
// `setTrainingStatsPort` y este connector se lo cablea con el agregado por empleado.
//
// `capacitacion.employeeId` YA ES `employee_profiles.id` (misma clave de join que
// empleados-attendance, a diferencia de housekeeping/mantenimiento que usan users.id). Solo
// DELEGA (regla #3) — antes de este connector, un curso completado no pesaba nada en el score
// (solo dejaba un documento en el expediente vía capacitacion-empleados).
import type { ConnectorContext } from 'arckode-framework'
import type { TrainingStatsPort } from '../modules/empleados'

export function empleadosCapacitacionConnector(ctx: ConnectorContext): void {
  const empleados = ctx.resolveModule<{ setTrainingStatsPort: (p: TrainingStatsPort) => void }>('empleados')
  const capacitacion = ctx.resolveModule<TrainingStatsPort>('capacitacion')

  empleados.setTrainingStatsPort({
    getStaffStats: (hotelId, from, to) => capacitacion.getStaffStats(hotelId, from, to),
  })
}
