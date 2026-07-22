// connectors/empleados-mantenimiento.ts — Wire: empleados ← mantenimiento (motor de evaluación #321).
//
// El motor de evaluación de desempeño necesita la productividad real de los TÉCNICOS, que vive en
// mantenimiento (tickets resueltos/cerrados por assignedTo). Empleados no puede importar mantenimiento,
// así que expone `setMaintenanceStatsPort` y este connector se lo cablea con el agregado por técnico.
//
// `mantenimiento.assignedTo` ES `users.id` — el motor lo cruza contra `employee_profiles.userId`
// (misma clave de join que empleados-housekeeping). Solo DELEGA (regla #3).

import type { ConnectorContext } from 'arckode-framework'
import type { MaintenanceStatsPort } from '../modules/empleados'

export function empleadosMantenimientoConnector(ctx: ConnectorContext): void {
  const empleados = ctx.resolveModule<{ setMaintenanceStatsPort: (p: MaintenanceStatsPort) => void }>('empleados')
  const mantenimiento = ctx.resolveModule<MaintenanceStatsPort>('mantenimiento')

  empleados.setMaintenanceStatsPort({
    getStaffStats: (hotelId, from, to) => mantenimiento.getStaffStats(hotelId, from, to),
  })
}
