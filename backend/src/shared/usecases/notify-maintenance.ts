// shared/usecases/notify-maintenance.ts — Avisos de mantenimiento.
//
// La lógica de qué aviso mandar por cada evento vive acá; el connector
// `mantenimiento-notificaciones` solo delega (regla: connectors solo wirean).

export interface NotificacionesPort {
  create(dto: Record<string, unknown>, user: { id: string; role: string; hotelId: string }): Promise<unknown>
}

interface MaintenanceOrder {
  hotelId: string
  title?: string
  status?: string
  assignedTo?: string
  roomNumber?: string
}

const sysUserFor = (hotelId: string) => ({ id: 'system', role: 'super_admin', hotelId })

/** Nueva orden creada: aviso general al hotel. */
export async function notifyMaintenanceCreated(notificaciones: NotificacionesPort, order: MaintenanceOrder): Promise<void> {
  await notificaciones.create({
    hotelId: order.hotelId,
    title: 'Nueva orden de mantenimiento',
    message: order.title ?? '',
    type: 'maintenance',
    read: 0,
    date: new Date().toISOString(),
  }, sysUserFor(order.hotelId))
}

/** Orden actualizada: aviso general al hotel. */
export async function notifyMaintenanceUpdated(notificaciones: NotificacionesPort, order: MaintenanceOrder): Promise<void> {
  await notificaciones.create({
    hotelId: order.hotelId,
    title: `Orden actualizada: ${order.status ?? ''}`.trim(),
    message: order.title ?? '',
    type: 'maintenance',
    read: 0,
    date: new Date().toISOString(),
  }, sysUserFor(order.hotelId))
}

/** Ticket asignado a un técnico: aviso PERSONAL (lleva `userId`). */
export async function notifyMaintenanceAssigned(notificaciones: NotificacionesPort, order: MaintenanceOrder): Promise<void> {
  if (!order.assignedTo) return
  const where = order.roomNumber ? `Habitación ${order.roomNumber}` : (order.title ?? 'Ticket')
  await notificaciones.create({
    hotelId: order.hotelId,
    userId: order.assignedTo,
    title: 'Nuevo ticket asignado',
    message: `${where} · ${order.title ?? ''}`.trim(),
    type: 'maintenance',
    read: 0,
    date: new Date().toISOString(),
  }, sysUserFor(order.hotelId))
}
