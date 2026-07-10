// shared/usecases/notify-task-assigned.ts — Te asignaron una habitación, enterate.
//
// Antes la asignación no dejaba rastro: la camarera se enteraba si abría la app
// y miraba. El aviso lleva `userId`, así que es para ella y no para todo el hotel.

/** Nombre legible del tipo de limpieza, para que el aviso diga algo. */
const CLEANING_LABELS: Record<string, string> = {
  full_cleaning: 'Limpieza completa',
  quick_cleaning: 'Limpieza rápida',
  deep_cleaning: 'Limpieza profunda',
  inspection: 'Inspección',
  maintenance: 'Mantenimiento',
}

export interface AssignedTask {
  hotelId: string
  staffId?: string
  roomId?: string
  type?: string
}

export interface NotificacionesPort {
  create(dto: Record<string, unknown>, user: { id: string; role: string; hotelId: string }): Promise<unknown>
}

export interface RoomsPort {
  getById(id: string, user: { id: string; role: string }): Promise<{ number?: string | number } | null>
}

/** El número visible. Un aviso sin habitación no manda a nadie a ningún lado. */
async function resolveRoomNumber(rooms: RoomsPort | null, roomId?: string): Promise<string | undefined> {
  if (!roomId || !rooms) return undefined
  try {
    const room = await rooms.getById(roomId, { id: 'system', role: 'super_admin' })
    return room?.number ? String(room.number) : undefined
  } catch {
    return undefined
  }
}

export async function notifyTaskAssigned(
  notificaciones: NotificacionesPort,
  rooms: RoomsPort | null,
  task: AssignedTask,
): Promise<void> {
  if (!task.staffId) return

  const roomNumber = await resolveRoomNumber(rooms, task.roomId)
  const where = roomNumber ? `Habitación ${roomNumber}` : 'Sin habitación'
  const what = CLEANING_LABELS[task.type ?? ''] ?? 'Limpieza'

  await notificaciones.create(
    {
      hotelId: task.hotelId,
      // El destinatario. Sin esto sería un aviso para todo el hotel.
      userId: task.staffId,
      title: 'Nueva tarea asignada',
      message: `${where} · ${what}`,
      type: 'cleaning',
      read: 0,
      date: new Date().toISOString(),
    },
    { id: 'system', role: 'super_admin', hotelId: task.hotelId },
  )
}
