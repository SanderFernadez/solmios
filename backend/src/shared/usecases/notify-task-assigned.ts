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
  priority?: string
}

/** Prioridad legible. `medium` es lo esperado y no avisa: ensuciaría el mensaje. */
const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Prioridad alta',
  low: 'Prioridad baja',
}

function priorityTag(priority?: string): string {
  const label = priority ? PRIORITY_LABELS[priority] : ''
  return label ? ` · ${label}` : ''
}

export interface NotificacionesPort {
  create(dto: Record<string, unknown>, user: { id: string; role: string; hotelId: string }): Promise<unknown>
}

export interface RoomsPort {
  getById(id: string, user: { id: string; role: string }): Promise<{ number?: string | number } | null>
}

/** Envío de push al teléfono de la persona (para que llegue con la app cerrada). */
export interface PushPort {
  notifyUser(
    userId: string,
    hotelId: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ): Promise<number>
}

/** El número visible. Un aviso sin habitación no manda a nadie a ningún lado. */
export async function resolveRoomNumber(rooms: RoomsPort | null, roomId?: string): Promise<string | undefined> {
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
  push?: PushPort | null,
): Promise<void> {
  if (!task.staffId) return

  const roomNumber = await resolveRoomNumber(rooms, task.roomId)
  const where = roomNumber ? `Habitación ${roomNumber}` : 'Sin habitación'
  const what = CLEANING_LABELS[task.type ?? ''] ?? 'Limpieza'
  const title = 'Nueva tarea asignada'
  const message = `${where} · ${what}${priorityTag(task.priority)}`

  // 1) Aviso IN-APP (la campanita), aunque no haya push configurado.
  await notificaciones.create(
    {
      hotelId: task.hotelId,
      // El destinatario. Sin esto sería un aviso para todo el hotel.
      userId: task.staffId,
      title,
      message,
      type: 'cleaning',
      read: 0,
      date: new Date().toISOString(),
    },
    { id: 'system', role: 'super_admin', hotelId: task.hotelId },
  )

  // 2) PUSH al teléfono, para que llegue con la app CERRADA. Si Firebase no está
  //    configurado o falla, no rompe la asignación: el aviso in-app ya quedó.
  if (push) {
    try {
      await push.notifyUser(task.staffId, task.hotelId, {
        title,
        body: message,
        data: {'type': 'cleaning'},
      })
    } catch {
      // Sin push, igual quedó el aviso in-app.
    }
  }
}
