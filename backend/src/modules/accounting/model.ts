// accounting/model.ts — Schema de la contabilidad de doble entrada.
// 4 tablas: plan de cuentas (accounts), asientos (journal_entries) + sus líneas
// (journal_lines), y períodos contables (accounting_periods). DB en inglés, multi-tenant
// por hotelId. Ver openspec/changes/contabilidad-tesoreria/design.md.
import type { ModelDefinition, ORM } from 'arckode-framework'

/** Plan de cuentas (chart of accounts). Jerárquico por `parentId`; solo las `isPostable` aceptan asientos. */
export const AccountModel: ModelDefinition = {
  table: 'accounts',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    code: { type: 'string', required: true },           // 1.1.01 (jerárquico)
    name: { type: 'string', required: true },
    // asset | liability | equity | income | expense
    type: { type: 'string', required: true },
    parentId: { type: 'string' },
    // ¿acepta asientos directos? Las cuentas de agrupación no (isPostable=0).
    isPostable: { type: 'number', default: 1 },
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

/** Asiento contable (cabecera). La suma de débitos de sus líneas = suma de créditos. */
export const JournalEntryModel: ModelDefinition = {
  table: 'journal_entries',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    entryDate: { type: 'string', required: true },
    description: { type: 'text' },
    // Origen que disparó el asiento (para idempotencia + trazabilidad).
    reference: { type: 'string', indexed: true },
    // invoice | payment | expense | deposit | folio | cash_shift | manual | adjustment
    referenceType: { type: 'string' },
    period: { type: 'string', required: true, indexed: true },  // YYYY-MM
    // draft | posted | reversed
    status: { type: 'string', default: 'draft' },
    reversalOf: { type: 'string' },   // id del asiento que revierte, si aplica
    // manual | connector
    source: { type: 'string', default: 'manual' },
    createdBy: { type: 'string' },
    postedAt: { type: 'string' },
  },
  timestamps: true,
}

/** Línea de un asiento (doble entrada). Cada línea es debe O haber contra una cuenta. */
export const JournalLineModel: ModelDefinition = {
  table: 'journal_lines',
  fields: {
    id: { type: 'string', required: true },
    entryId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    accountId: { type: 'string', required: true, indexed: true },
    debit: { type: 'number', default: 0 },
    credit: { type: 'number', default: 0 },
    description: { type: 'string' },
  },
  timestamps: true,
}

/** Período contable mensual. Un período `locked` no acepta asientos nuevos. */
export const AccountingPeriodModel: ModelDefinition = {
  table: 'accounting_periods',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    period: { type: 'string', required: true },   // YYYY-MM
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    // open | closed | locked
    status: { type: 'string', default: 'open' },
    closedBy: { type: 'string' },
    closedAt: { type: 'string' },
  },
  timestamps: true,
}

export function registerAccountingModels(orm: ORM): void {
  orm.define('Accounts', AccountModel)
  orm.define('JournalEntries', JournalEntryModel)
  orm.define('JournalLines', JournalLineModel)
  orm.define('AccountingPeriods', AccountingPeriodModel)
}
