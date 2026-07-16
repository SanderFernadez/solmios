// connectors/empleados-housekeeping.ts — Wire: empleados ← housekeeping (motor de evaluación #321).
//
// El motor de evaluación de desempeño (empleados) necesita la productividad y la calidad reales de
// las camareras, que viven en housekeeping. Empleados no puede importar housekeeping, así que expone
// el puerto `setHousekeepingStatsPort` y este connector se lo cablea con el agregado por staff.
//
// `housekeeping.staffId` ES `users.id` — el motor lo cruza contra `employee_profiles.userId`.
// Solo DELEGA (regla #3): passthrough del método público del service de housekeeping.

import type { ConnectorContext } from 'arckode-framework'
import type { HkStatsPort } from '../modules/empleados'
import type { HousekeepingStatsPort } from '../modules/housekeeping'

export function empleadosHousekeepingConnector(ctx: ConnectorContext): void {
  const empleados = ctx.resolveModule<{ setHousekeepingStatsPort: (p: HkStatsPort) => void }>('empleados')
  const housekeeping = ctx.resolveModule<HousekeepingStatsPort>('housekeeping')

  empleados.setHousekeepingStatsPort({
    getStaffStats: (hotelId, from, to) => housekeeping.getStaffStats(hotelId, from, to),
  })
}
