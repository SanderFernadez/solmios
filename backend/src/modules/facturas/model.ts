// facturas/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const FacturasModel: ModelDefinition = {
  table: 'invoices',
  fields: {
    id: { type: 'string', required: true },
    reservationId: { type: 'string' },
    hotelId: { type: 'string', required: true, indexed: true },
    guestId: { type: 'string' },
    invoiceNumber: { type: 'string', required: true },
    type: { type: 'string', default: "invoice" },
    amount: { type: 'number', required: true },
    taxes: { type: 'number', default: 0 },
    currency: { type: 'string', default: "USD" },
    status: { type: 'string', default: "pending" },
    issueDate: { type: 'string', required: true },
    dueDate: { type: 'string' },
    notes: { type: 'text' },
    ncf: { type: 'string' },
    paymentMethod: { type: 'string' },
    amountPaid: { type: 'number', default: 0 },
    fileUrl: { type: 'string' },
  },
  timestamps: true,
}

export function registerFacturasModels(orm: ORM): void {
  orm.define('Invoices', FacturasModel)
}
