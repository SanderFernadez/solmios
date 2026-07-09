// bookingengine/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.

import type { PublicBookingDTO, ConversionEventDTO } from './types'

export interface BookingengineSockets {
  onBookingCreated?: (data: PublicBookingDTO) => Promise<void>
  /** Stripe confirmó el cobro del widget. Es plata real: tiene que asentarse en `payments`. */
  onBookingPaid?: (data: PublicBookingDTO) => Promise<void>
  onBookingCancelled?: (id: string) => Promise<void>
  onConversionEvent?: (event: ConversionEventDTO) => Promise<void>
}
