// shared/usecases/notify-task-completed.ts — La camarera terminó: avisale al supervisor.
//
// Es la otra mitad del loop de trabajo. Al ASIGNAR se avisa a la camarera
// (`notify-task-assigned`); al COMPLETAR se avisa a quien revisa. Sin esto el
// supervisor solo se enteraba con la app abierta (polling local del mobile).

import {
  resolveRoomNumber,
  type NotificacionesPort,
  type RoomsPort,
  type PushPort,
} from './notify-task-assigned'

/** Listado de usuarios del hotel, para encontrar a los supervisores. */
export interface UsersPort {
  list(hotelId?: string): Promise<any[]>
}

export interface CompletedTask {
  hotelId: string
  roomId?: string
  /** Quién la terminó, para nombrar a la camarera en el aviso. */
  staffId?: string
}

/**
 * Notifica a los supervisores del hotel (in-app + push) que hay una limpieza para
 * revisar. Si el hotel no tiene supervisores, cae al `hotel_admin` (el dueño revisa).
 * Así no se le duplica el aviso al admin cuando ya hay un supervisor a cargo.
 */
export async function notifyTaskCompleted(
  notificaciones: NotificacionesPort,
  users: UsersPort,
  rooms: RoomsPort | null,
  task: CompletedTask,
  push?: PushPort | null,
): Promise<void> {
  const hotelUsers = await users.list(task.hotelId).catch(() => [] as any[])
  const supervisors = hotelUsers.filter((u: any) => u.role === 'supervisor')
  const recipients = supervisors.length > 0
    ? supervisors
    : hotelUsers.filter((u: any) => u.role === 'hotel_admin')
  if (recipients.length === 0) return

  const roomNumber = await resolveRoomNumber(rooms, task.roomId)
  const staffName = task.staffId
    ? (hotelUsers.find((u: any) => String(u.id) === String(task.staffId))?.name ?? '')
    : ''
  const where = roomNumber ? `Habitación ${roomNumber}` : 'Una habitación'
  const who = staffName ? ` · ${staffName}` : ''
  const title = 'Limpieza lista para revisar'
  const message = `${where} terminada${who}`

  for (const recipient of recipients) {
    // 1) Aviso IN-APP (la campanita), aunque no haya push configurado.
    await notificaciones.create(
      {
        hotelId: task.hotelId,
        userId: recipient.id,
        title,
        message,
        type: 'cleaning',
        read: 0,
        date: new Date().toISOString(),
      },
      { id: 'system', role: 'super_admin', hotelId: task.hotelId },
    )

    // 2) PUSH al teléfono, para que llegue con la app CERRADA. Best-effort: sin
    //    Firebase no rompe el checkout de la tarea; el aviso in-app ya quedó.
    if (push) {
      try {
        await push.notifyUser(recipient.id, task.hotelId, {
          title,
          body: message,
          data: { type: 'cleaning_review' },
        })
      } catch {
        // Sin push, igual quedó el aviso in-app.
      }
    }
  }
}
