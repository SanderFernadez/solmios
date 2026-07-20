// connectors/housekeeping-habitaciones.ts — Wire: housekeeping → habitaciones
//
// Cuando el supervisor aprueba una limpieza (tarea → inspected), la habitación vuelve a estar
// disponible para venderse. Antes quedaba trabada en 'cleaning' desde el checkout (#392): recepción
// veía la habitación limpia pero el sistema no la dejaba asignar.
//
// La lógica (incluida la guarda de no pisar otros estados) vive en el usecase compartido, testeable
// sin el framework. El connector sólo cablea el evento con el módulo habitaciones.

import type { ConnectorContext } from 'arckode-framework'
import type { HousekeepingDTO } from '../modules/housekeeping/types'
import { releaseRoomAfterCleaning, type RoomPort } from '../shared/usecases/release-room-after-cleaning'

export function housekeepingHabitacionesConnector(ctx: ConnectorContext): void {
  const housekeeping = ctx.resolveModule<{ setSockets: (s: any) => void }>('housekeeping')

  housekeeping.setSockets({
    onTaskInspected: async (task: HousekeepingDTO) => {
      let rooms: RoomPort | null = null
      try {
        rooms = ctx.resolveModule<RoomPort>('habitaciones')
      } catch {
        // Sin el módulo de habitaciones no hay nada que liberar; la aprobación ya quedó registrada.
        return
      }
      await releaseRoomAfterCleaning(rooms, task)
    },
  })
}
