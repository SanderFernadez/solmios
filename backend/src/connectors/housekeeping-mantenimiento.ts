// connectors/housekeeping-mantenimiento.ts — Wire: housekeeping → mantenimiento
//
// Cuando la camarera reporta algo roto desde su tarea, se abre un ticket real
// de mantenimiento con la descripción y las fotos. Antes el reporte solo dejaba
// una línea en las notas de la tarea de limpieza: mantenimiento nunca lo veía,
// y no se puede arreglar algo sin saber qué es ni verlo.

import type { ConnectorContext } from 'arckode-framework'
import type { IssueReport } from '../modules/housekeeping/sockets'

/** Un reporte de la camarera no es una emergencia por defecto, pero tampoco trivial. */
const REPORTED_PRIORITY = 'medium'

export function housekeepingMantenimientoConnector(ctx: ConnectorContext): void {
  const housekeeping = ctx.resolveModule<{ setSockets: (s: any) => void }>('housekeeping')

  housekeeping.setSockets({
    onIssueReported: async (issue: IssueReport) => {
      const mantenimiento = ctx.resolveModule<{
        create: (dto: any, user: any) => Promise<any>
      }>('mantenimiento')

      const roomNumber = await resolveRoomNumber(ctx, issue.roomId)
      const where = roomNumber ? `Hab. ${roomNumber}` : 'Sin habitación'

      await mantenimiento.create(
        {
          hotelId: issue.hotelId,
          roomId: issue.roomId,
          roomNumber,
          title: `Reporte de limpieza — ${where}`,
          description: issue.description,
          photos: issue.photos,
          priority: REPORTED_PRIORITY,
          status: 'open',
          reportedDate: new Date().toISOString(),
        },
        // El ticket lo levanta la camarera, no el sistema: así mantenimiento ve
        // quién reportó, y a ella no se le notifica su propio ticket.
        { id: issue.reportedBy, role: 'housekeeper', hotelId: issue.hotelId },
      )
    },
  })
}

/** El número visible de la habitación. Un ticket sin él manda a nadie a ningún lado. */
async function resolveRoomNumber(
  ctx: ConnectorContext,
  roomId: string | undefined,
): Promise<string | undefined> {
  if (!roomId) return undefined
  try {
    const habitaciones = ctx.resolveModule<{
      getById: (id: string, user: any) => Promise<any>
    }>('habitaciones')
    const room = await habitaciones.getById(roomId, { id: 'system', role: 'super_admin' })
    return room?.number ? String(room.number) : undefined
  } catch {
    // Sin el número el ticket sigue siendo útil: lleva la descripción y las fotos.
    return undefined
  }
}
