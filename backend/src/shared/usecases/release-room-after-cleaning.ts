// Devuelve una habitación a 'available' cuando su limpieza fue APROBADA por el supervisor.
//
// El bug (#392): al hacer checkout, el connector reservas-housekeeping pone la habitación en
// 'cleaning' y crea la tarea. Pero cuando la tarea se completaba/inspeccionaba, NADIE devolvía la
// habitación a 'available' → quedaba trabada y recepción no la podía vender.
//
// Decisión de negocio (elegida por el dueño del producto): se libera al APROBAR (status inspected),
// no al completar. Una habitación no se vende hasta que el supervisor verificó la limpieza.
//
// Guarda imprescindible: sólo se libera si la habitación SIGUE en 'cleaning'. Entre el checkout y la
// aprobación pudo pasar cualquier cosa —se puso en mantenimiento, se ocupó, se bloqueó, ya se
// reservó— y pisar ese estado con 'available' reintroduciría el bug al revés (vender algo no vendible).

export interface RoomPort {
  getById(id: string, user: SystemUser): Promise<{ id: string; status?: string } | null>
  update(id: string, dto: { status: string }, user: SystemUser): Promise<unknown>
}

interface SystemUser {
  id: string
  role: string
  hotelId?: string
}

export interface CleaningTask {
  roomId?: string | null
  hotelId?: string | null
  status?: string | null
}

/**
 * Libera la habitación de la tarea si corresponde. No lanza: es una reacción a un evento ya
 * consumado (la limpieza ya se aprobó), así que un problema al liberar se registra pero no
 * revierte la aprobación. Devuelve true sólo si efectivamente cambió el estado.
 */
export async function releaseRoomAfterCleaning(
  rooms: RoomPort,
  task: CleaningTask,
  log?: { warn: (msg: string, e?: unknown) => void },
): Promise<boolean> {
  // Sólo la aprobación libera. Otros estados (completed, pending) no.
  if (task.status !== 'inspected') return false
  if (!task.roomId || !task.hotelId) return false

  const sysUser: SystemUser = { id: 'system-connector', role: 'super_admin', hotelId: task.hotelId }
  try {
    const room = await rooms.getById(task.roomId, sysUser)
    if (!room) return false
    // Guarda: no pisar maintenance / occupied / reserved / out_of_order.
    if (room.status !== 'cleaning') return false
    await rooms.update(task.roomId, { status: 'available' }, sysUser)
    return true
  } catch (e) {
    log?.warn?.('No se pudo liberar la habitación tras aprobar la limpieza', e)
    return false
  }
}
