// gastos/model.ts — Schema de base de datos de gastos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const GastosModel: ModelDefinition = {
  table: 'expenses',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    category: { type: 'string', default: 'general' },
    concept: { type: 'string', required: true },
    amount: { type: 'number', required: true },
    date: { type: 'string' },
    provider: { type: 'string' },
    invoiceNumber: { type: 'string' },
    notes: { type: 'text' },
    paid: { type: 'number', default: 0 },
    // cash | card | transfer | other. Solo `cash` mueve el cajón físico (conector gastos-caja),
    // igual que payments-caja. Default `other`: un gasto no descuadra el arqueo sin decirlo.
    paymentMethod: { type: 'string', default: 'other' },
  },
  timestamps: true,
}

export function registerGastosModels(orm: ORM): void {
  orm.define('Expenses', GastosModel)
}
