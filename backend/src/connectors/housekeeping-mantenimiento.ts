// connectors/housekeeping-mantenimiento.ts — Wire: housekeeping → mantenimiento
//
// Cuando la camarera reporta algo roto desde su tarea, se abre un ticket real de mantenimiento con
// la descripción y las fotos. La lógica vive en shared/usecases/open-maintenance-from-housekeeping.
//
// NO es best-effort: si el ticket no se puede abrir, el reporte falla y la camarera lo ve. El
// usecase de housekeeping escribe la nota DESPUÉS, así un fallo no deja una nota sin ticket.

import type { ConnectorContext } from 'arckode-framework'
import type { IssueReport } from '../modules/housekeeping/sockets'
import {
  openMaintenanceFromHousekeeping,
  type MantenimientoPort,
  type HabitacionesPort,
} from '../shared/usecases/open-maintenance-from-housekeeping'

export function housekeepingMantenimientoConnector(ctx: ConnectorContext): void {
  const housekeeping = ctx.resolveModule<{ setSockets: (s: any) => void }>('housekeeping')

  housekeeping.setSockets({
    onIssueReported: async (issue: IssueReport) => {
      const mantenimiento = ctx.resolveModule<MantenimientoPort>('mantenimiento')
      let habitaciones: HabitacionesPort | null = null
      try {
        habitaciones = ctx.resolveModule<HabitacionesPort>('habitaciones')
      } catch {
        // Sin el número de habitación el ticket sigue siendo útil: lleva descripción y fotos.
      }
      await openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue)
    },
  })
}
