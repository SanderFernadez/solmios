// folios/model.ts — Schema de base de datos (cabecera de folio + líneas de cargo/pago)
import type { ModelDefinition, ORM } from 'arckode-framework'

export const FoliosModel: ModelDefinition = {
  table: 'folios',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    reservationId: { type: 'string', indexed: true },
    guestId: { type: 'string' },
    roomId: { type: 'string' },
    status: { type: 'string', default: 'open' },
    currency: { type: 'string', default: 'USD' },
    invoiceId: { type: 'string' },
    openedAt: { type: 'string' },
    closedAt: { type: 'string' },
  },
  timestamps: true,
}

export const FolioChargesModel: ModelDefinition = {
  table: 'folio_charges',
  fields: {
    id: { type: 'string', required: true },
    folioId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    description: { type: 'text' },
    category: { type: 'string', default: 'other' },
    kind: { type: 'string', default: 'charge' },
    quantity: { type: 'number', default: 1 },
    amount: { type: 'number', required: true },
    taxes: { type: 'number', default: 0 },
    total: { type: 'number', required: true },
    source: { type: 'string', default: 'manual' },
    postedAt: { type: 'string' },
  },
  timestamps: true,
}

export function registerFoliosModels(orm: ORM): void {
  orm.define('Folios', FoliosModel)
  orm.define('FolioCharges', FolioChargesModel)
}
