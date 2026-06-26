// bookingengine/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.

import type { PublicBookingDTO, ConversionEventDTO } from './types'

export interface BookingengineSockets {
  onBookingCreated?: (data: PublicBookingDTO) => Promise<void>
  onBookingCancelled?: (id: string) => Promise<void>
  onConversionEvent?: (event: ConversionEventDTO) => Promise<void>
}
