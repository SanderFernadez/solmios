// cash/model.ts — Schema de base de datos (cash_movements + cash_shifts)
// DB English only. Multi-tenant por hotelId.

import type { ModelDefinition, ORM } from 'arckode-framework'

// Movimientos de caja (ingresos/egresos manuales y automáticos del conector payments→caja).
export const CashMovementsModel: ModelDefinition = {
  table: 'cash_movements',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    shiftId: { type: 'string', indexed: true },
    type: { type: 'string', required: true },        // income | expense | opening | closing
    amount: { type: 'number', required: true },
    method: { type: 'string' },                        // cash | card | transfer | link | other
    concept: { type: 'string' },
    category: { type: 'string', default: 'general' },  // payment | expense | adjustment | opening | closing
    source: { type: 'string', default: 'manual' },     // manual | payment_connector | migrated
    register: { type: 'string', default: 'reception' }, // reception | restaurant — punto de venta físico dueño del movimiento
    guestName: { type: 'string' },
    roomNumber: { type: 'string' },
    reservationId: { type: 'string', indexed: true },
    folioId: { type: 'string' },
    paymentId: { type: 'string', indexed: true },      // FK al Payment que generó el movimiento (dedup)
    expenseId: { type: 'string', indexed: true },      // FK al Expense que generó el egreso (dedup)
    reference: { type: 'string' },
    createdBy: { type: 'string' },
    notes: { type: 'text' },
  },
  timestamps: true,
}

// Turnos de caja: apertura/cierre con arqueo (counted vs expected → difference).
export const CashShiftsModel: ModelDefinition = {
  table: 'cash_shifts',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    status: { type: 'string', default: 'open' },       // open | closed
    register: { type: 'string', default: 'reception' }, // reception | restaurant — cajón físico de este turno
    openingAmount: { type: 'number', default: 0 },
    countedAmount: { type: 'number' },
    expectedAmount: { type: 'number' },
    difference: { type: 'number' },
    denominations: { type: 'json', default: '{}' },    // conteo de billetes opcional
    openedBy: { type: 'string' },
    closedBy: { type: 'string' },
    openedAt: { type: 'string' },
    closedAt: { type: 'string' },
    notes: { type: 'text' },
  },
  timestamps: true,
}

export function registerCashModels(orm: ORM): void {
  orm.define('CashMovements', CashMovementsModel)
  orm.define('CashShifts', CashShiftsModel)
}
