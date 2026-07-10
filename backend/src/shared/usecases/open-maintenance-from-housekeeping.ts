// shared/usecases/open-maintenance-from-housekeeping.ts — La camarera reporta, mantenimiento se entera.
//
// Antes el reporte solo apendaba una línea a las notas de la tarea de limpieza: mantenimiento nunca
// veía la descripción ni las fotos, y no se puede arreglar algo sin saber qué es ni verlo.
//
// IDEMPOTENTE por `sourceTaskId` + `description`. La camarera reporta desde el celular, con mala
// señal: tocar dos veces "reportar", o un reintento de la app, no puede abrir dos tickets al de
// mantenimiento. Se compara la descripción porque una misma tarea sí puede tener dos incidencias
// distintas ("gotea el aire" y "cortina rota").

import type { IssueReport } from '../../modules/housekeeping/sockets'

/** Un reporte de la camarera no es una emergencia por defecto, pero tampoco trivial. */
const REPORTED_PRIORITY = 'medium'

export interface MantenimientoPort {
  findBySourceTask(hotelId: string, sourceTaskId: string): Promise<Array<{ description?: string }>>
  create(dto: Record<string, unknown>, user: { id: string; role: string; hotelId: string }): Promise<{ id: string }>
}

export interface HabitacionesPort {
  getById(id: string, user: { id: string; role: string }): Promise<{ number?: string | number } | null>
}

/** El número visible de la habitación. Un ticket sin él manda a nadie a ningún lado. */
async function resolveRoomNumber(habitaciones: HabitacionesPort | null, roomId?: string): Promise<string | undefined> {
  if (!roomId || !habitaciones) return undefined
  try {
    const room = await habitaciones.getById(roomId, { id: 'system', role: 'super_admin' })
    return room?.number ? String(room.number) : undefined
  } catch {
    // Sin el número el ticket sigue siendo útil: lleva la descripción y las fotos.
    return undefined
  }
}

export async function openMaintenanceFromHousekeeping(
  mantenimiento: MantenimientoPort,
  habitaciones: HabitacionesPort | null,
  issue: IssueReport,
): Promise<{ id: string } | null> {
  if (!issue.description?.trim()) return null

  const existing = await mantenimiento.findBySourceTask(issue.hotelId, issue.taskId)
  if (existing.some((t) => t.description === issue.description)) return null

  const roomNumber = await resolveRoomNumber(habitaciones, issue.roomId)
  const where = roomNumber ? `Hab. ${roomNumber}` : 'Sin habitación'

  return mantenimiento.create(
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
      sourceTaskId: issue.taskId,
    },
    // El ticket lo levanta la camarera, no el sistema: mantenimiento ve a quién preguntarle.
    { id: issue.reportedBy, role: 'housekeeper', hotelId: issue.hotelId },
  )
}
