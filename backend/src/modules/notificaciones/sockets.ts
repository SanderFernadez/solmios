// notificaciones/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { NotificacionesDTO } from './types'

export interface NotificacionesSockets {
  onNotificacionesCreated?: (data: NotificacionesDTO) => Promise<void>
  onNotificacionesUpdated?: (data: NotificacionesDTO) => Promise<void>
  onNotificacionesDeleted?: (id: string) => Promise<void>
}
