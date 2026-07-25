// caja-chica/model.ts — Schema de base de datos de caja chica (PETTY-0).
// Dos tablas: fondos fijos (con custodio y saldo persistido) y reposiciones.
// DB en inglés, multi-tenant por hotelId. custodianId/requestedBy/approvedBy → users.id.
import type { ModelDefinition, ORM } from 'arckode-framework'

/**
 * Fondo fijo de caja chica. El `custodianId` es el responsable del dinero (users.id),
 * NO un employee-profile (regla del proyecto: staffId/providers resuelven contra users).
 * `targetAmount` = tope del fondo; `currentBalance` = saldo persistido (como bank_accounts).
 */
export const PettyCashFundsModel: ModelDefinition = {
  table: 'petty_cash_funds',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    // Responsable del fondo (users.id).
    custodianId: { type: 'string', required: true, indexed: true },
    targetAmount: { type: 'number', required: true },
    // Saldo persistido: se descuenta al gastar (conector caja-chica-gastos) y se repone
    // al completar una reposición (usecases/replenish.ts). Recalcular en cada mutación.
    currentBalance: { type: 'number', default: 0 },
    currency: { type: 'string', default: 'USD' },
    active: { type: 'number', default: 1 },
    notes: { type: 'text' },
  },
  timestamps: true,
}

/**
 * Reposición de caja chica. Workflow v1: `requested → completed` (la completa el admin a mano).
 * Al `completed`, `currentBalance += amount`. En v2 se agregará `approved` intermedio y moverá
 * banco/contabilidad (ver proposal.md "Out of scope").
 */
export const PettyCashReplenishmentModel: ModelDefinition = {
  table: 'petty_cash_replenishments',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    fundId: { type: 'string', required: true, indexed: true },
    amount: { type: 'number', required: true },
    // requested | completed | cancelled
    status: { type: 'string', default: 'requested' },
    // Quién pide la reposición (users.id).
    requestedBy: { type: 'string', indexed: true },
    // Quién completó la reposición (users.id). Se setea al pasar a `completed`.
    approvedBy: { type: 'string' },
    // Origen del dinero. En v1 NO se mueve (la reposición es lógica); v2 restará bank_accounts.
    sourceBankAccountId: { type: 'string', indexed: true },
    notes: { type: 'text' },
  },
  timestamps: true,
}

export function registerCajaChicaModels(orm: ORM): void {
  orm.define('PettyCashFunds', PettyCashFundsModel)
  orm.define('PettyCashReplenishments', PettyCashReplenishmentModel)
}
