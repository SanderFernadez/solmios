// usecases/types.ts — Subtipos mínimos de entidades cross-module compartidos por los usecases.
//
// Evitan `any` en las dependencias de los use cases sin acoplarlos a los módulos ajenos
// (guests/rooms/hotels/marketing). Cada use case declara solo los campos que lee.

export interface GuestSummary {
  id: string
  hotelId?: string
  name?: string
  firstName?: string
  email?: string
  nationality?: string
  language?: string
}

export interface RoomSummary {
  id: string
  hotelId?: string
  number?: string
  type?: string
  maxGuests?: number
  basePrice?: number
}

export interface HotelSummary {
  id: string
  name?: string
  address?: string
  phone?: string
}

/** Subtipo del log de mensajes (modelo MessageLogs del módulo marketing). */
export interface MessageLogSummary {
  id: string
  hotelId: string
  reservationId?: string | null
  messageId?: string | null
  messageType: string
  status?: string | null
  recipient?: string | null
  response?: string | null
  sentAt?: string | null
}
