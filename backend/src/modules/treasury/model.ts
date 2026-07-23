// treasury/model.ts — Schema de tesorería (TES-0). 4 tablas: cuentas bancarias, movimientos
// bancarios (para conciliar), proveedores (para AP) y presupuestos. AR/AP NO tienen tabla: se
// derivan de invoices/folio_charges (AR) y expenses (AP). DB en inglés, multi-tenant por hotelId.
import type { ModelDefinition, ORM } from 'arckode-framework'

/** Cuenta bancaria del hotel. Opcionalmente vinculada a una cuenta contable (accounts.id). */
export const BankAccountModel: ModelDefinition = {
  table: 'bank_accounts',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    bank: { type: 'string' },
    accountNumber: { type: 'string' },
    currency: { type: 'string', default: 'USD' },
    // checking | savings | cash
    type: { type: 'string', default: 'checking' },
    openingBalance: { type: 'number', default: 0 },
    currentBalance: { type: 'number', default: 0 },
    accountId: { type: 'string' },   // FK opcional a accounts (1.1.02 Bancos)
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

/** Movimiento bancario importado (CSV) para conciliar contra `payments`. */
export const BankMovementModel: ModelDefinition = {
  table: 'bank_movements',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    bankAccountId: { type: 'string', required: true, indexed: true },
    date: { type: 'string' },
    description: { type: 'string' },
    amount: { type: 'number', default: 0 },   // + entrada / − salida
    reference: { type: 'string' },
    reconciled: { type: 'number', default: 0, indexed: true },
    paymentId: { type: 'string' },            // match con payments al conciliar
  },
  timestamps: true,
}

/** Proveedor (para agrupar las cuentas por pagar). */
export const SupplierModel: ModelDefinition = {
  table: 'suppliers',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    taxId: { type: 'string' },
    contact: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

/** Presupuesto por categoría y período (para el control de gastos). */
export const BudgetModel: ModelDefinition = {
  table: 'budgets',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    period: { type: 'string', required: true },   // YYYY-MM
    category: { type: 'string', required: true },
    budgetedAmount: { type: 'number', default: 0 },
    notes: { type: 'text' },
  },
  timestamps: true,
}

export function registerTreasuryModels(orm: ORM): void {
  orm.define('BankAccounts', BankAccountModel)
  orm.define('BankMovements', BankMovementModel)
  orm.define('Suppliers', SupplierModel)
  orm.define('Budgets', BudgetModel)
}
