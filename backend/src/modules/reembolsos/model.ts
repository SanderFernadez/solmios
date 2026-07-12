// reembolsos/model.ts — Reembolsos de gastos del empleado (Odoo hr_expense).
//
// Distinto de `/gastos` (gasto OPERATIVO del hotel): esto es el gasto que ADELANTA el empleado
// (viáticos, compras, transporte) y la empresa le reintegra. Flujo: draft → submitted → approved
// → paid, o rejected. `employeeId` referencia employee_profiles.id por valor.

import type { ModelDefinition, ORM } from 'arckode-framework'

export const ExpenseClaimModel: ModelDefinition = {
  table: 'expense_claims',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    category: { type: 'string' },              // transporte, comida, alojamiento, materiales…
    description: { type: 'string', required: true },
    amount: { type: 'number', required: true },
    currency: { type: 'string', default: 'DOP' },
    date: { type: 'string', required: true },  // fecha del gasto
    status: { type: 'string', default: 'draft' }, // draft · submitted · approved · rejected · paid
    receiptUrl: { type: 'string' },
    notes: { type: 'string' },
    approvedBy: { type: 'string' },
    approvedAt: { type: 'string' },
    rejectReason: { type: 'string' },
    paidAt: { type: 'string' },
    paymentMethod: { type: 'string' },          // cash · transfer · payroll
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

export function registerReembolsosModels(orm: ORM): void {
  orm.define('ExpenseClaim', ExpenseClaimModel)
}
