// reservas/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const ReservasModel: ModelDefinition = {
  table: 'reservations',
  fields: {
    id: { type: 'string', required: true },
    guestId: { type: 'string' },
    roomId: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    checkIn: { type: 'string', required: true },
    checkOut: { type: 'string', required: true },
    status: { type: 'string', default: 'pending' },
    channel: { type: 'string', default: 'direct' },
    totalAmount: { type: 'number', required: true },
    deposit: { type: 'number', default: 0 },
    currency: { type: 'string', default: 'USD' },
    adults: { type: 'number', default: 2 },
    children: { type: 'number', default: 0 },
    notes: { type: 'text' },
    // Campos OTA + pagos (Fase 1)
    source: { type: 'string', default: 'direct' },
    externalLocator: { type: 'string' },
    commission: { type: 'number', default: 0 },
    commissionAmount: { type: 'number', default: 0 },
    paymentMethod: { type: 'string' },
    pendingAmount: { type: 'number', default: 0 },
    autoSendEnabled: { type: 'boolean', default: true },
    preCheckinStatus: { type: 'string', default: 'pending' },
    preCheckinHash: { type: 'string' },
    groupId: { type: 'string' },
    otaNotes: { type: 'text' },
    // Campos nuevos del modal
    depositPercentage: { type: 'number', default: 100 },
    depositStatus: { type: 'string', default: 'unpaid' },
    ownerNotes: { type: 'text' },
    regime: { type: 'string', default: 'room_only' },
    promoCode: { type: 'string' },
    communicateClient: { type: 'string', default: 'none' },
    // Check-in / check-out real (folio + auditoría)
    checkedInAt: { type: 'string' },
    checkedOutAt: { type: 'string' },
    folioId: { type: 'string' },
  },
  timestamps: true,
}

export function registerReservasModels(orm: ORM): void {
  orm.define('Reservations', ReservasModel)
}
