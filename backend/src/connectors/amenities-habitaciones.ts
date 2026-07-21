// connectors/amenities-habitaciones.ts — Elimina la dualidad de datos de amenities.
// amenities emite onRoomAmenitiesUpdated → syncRoomAmenitiesCsv denormaliza el CSV vestigial
// Rooms.amenities desde RoomAmenities (fuente de verdad). El connector solo wirea; la lógica
// vive en el usecase. Best-effort: nunca rompe la asignación de amenities.
// Nota: sync going-forward — las habitaciones existentes actualizan su CSV al re-guardar amenities.

import type { ConnectorContext } from 'arckode-framework'
import { syncRoomAmenitiesCsv } from '../shared/usecases/sync-room-amenities-csv'

export function amenitiesHabitacionesConnector(orm: any): (ctx: ConnectorContext) => void {
  return (ctx: ConnectorContext) => {
    const amenities = ctx.resolveModule<{ setSockets: (s: any) => void }>('amenities')
    amenities.setSockets({
      onRoomAmenitiesUpdated: (roomId: string, keys: string[]) =>
        syncRoomAmenitiesCsv(orm, roomId, keys).catch(() => {}),
    })
  }
}
