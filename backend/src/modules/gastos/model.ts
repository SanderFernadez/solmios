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
    // Vínculo opcional a un proveedor del catálogo (treasury.suppliers) para el aging de cuentas
    // por pagar (AP). Si está vacío, el AP agrupa por el texto libre `provider`.
    supplierId: { type: 'string', indexed: true },
    invoiceNumber: { type: 'string' },
    notes: { type: 'text' },
    paid: { type: 'number', default: 0 },
    // cash | card | transfer | other. Solo `cash` mueve el cajón físico (conector gastos-caja),
    // igual que payments-caja. Default `other`: un gasto no descuadra el arqueo sin decirlo.
    paymentMethod: { type: 'string', default: 'other' },
    // Quién originó el gasto: `manual` o el conector que lo generó (`payroll`). Un gasto automático
    // no se edita acá: se edita en su origen.
    source: { type: 'string', default: 'manual' },
    // Id de la entidad que lo originó (el `runId` de la nómina). Clave de deduplicación.
    sourceId: { type: 'string', indexed: true },
    // Fondo de caja chica del que salió el gasto (petty_cash_funds.id). Si está seteado, el
    // conector caja-chica-gastos descuenta/reverte `fund.currentBalance`. Vacío = gasto común.
    pettyCashFundId: { type: 'string', indexed: true },
  },
  timestamps: true,
}

export function registerGastosModels(orm: ORM): void {
  orm.define('Expenses', GastosModel)
}
