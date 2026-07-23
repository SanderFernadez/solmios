// accounting/usecases/journal-entry.ts — Asientos de doble entrada (CTB-2).
// Invariante: SUM(debit) = SUM(credit). Un asiento posteado es inmutable (solo se revierte).
// Crea cabecera + líneas en una transacción ORM (atómico). Dedup por reference+referenceType
// para los asientos automáticos (CTB-4). Ver design.md §reglas contables.
import type { ORM, RepositoryAdapter } from 'arckode-framework'
import { ValidationError, NotFoundError, ConflictError } from 'arckode-framework'
import type { AccountDTO } from '../types'

// 0.005: como los totales ya van redondeados a 2 decimales, su diferencia es múltiplo de 0.01.
// Con 0.01 un descuadre de exactamente 1 centavo (0.01 > 0.01 = false) se colaba. Con 0.005,
// diff 0 pasa y diff 0.01 se rechaza. No hay error de float que absorber tras round2.
const BALANCE_EPSILON = 0.005
const YMD = /^\d{4}-\d{2}-\d{2}/   // el período (YYYY-MM) sale de acá; una fecha malformada lo corrompe

export interface JournalLineInput {
  accountId: string
  debit?: number
  credit?: number
  description?: string
}

export interface CreateEntryInput {
  entryDate: string
  description?: string
  reference?: string
  referenceType?: string
  source?: 'manual' | 'connector'
  lines: JournalLineInput[]
}

export interface JournalDeps {
  orm: ORM
  accounts: RepositoryAdapter<AccountDTO>
  entries: RepositoryAdapter<any>
  lines: RepositoryAdapter<any>
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Valida las líneas contra el plan de cuentas del hotel y el cuadre debe=haber. */
async function validateLines(deps: JournalDeps, hotelId: string, lines: JournalLineInput[]): Promise<void> {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ValidationError('Un asiento requiere al menos 2 líneas (doble entrada)')
  }
  let totalDebit = 0, totalCredit = 0
  for (const l of lines) {
    const debit = Number(l.debit || 0), credit = Number(l.credit || 0)
    // NaN/Infinity: un `debit:"abc"` daba NaN y se colaba (NaN>0.01 es false) → línea corrupta persistida.
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) throw new ValidationError('Débito/crédito deben ser numéricos')
    if (debit < 0 || credit < 0) throw new ValidationError('Débito y crédito no pueden ser negativos')
    if ((debit > 0) === (credit > 0)) {
      throw new ValidationError('Cada línea debe tener débito O crédito (exactamente uno)')
    }
    // La cuenta debe existir, ser del hotel y ser posteable (findOne, no findById: no es acceso por-ownership).
    const acc = await deps.accounts.findOne({ id: l.accountId })
    if (!acc || acc.hotelId !== hotelId) throw new ValidationError(`Cuenta ${l.accountId} inexistente o de otro hotel`)
    if (acc.isPostable === 0) throw new ValidationError(`La cuenta ${acc.code} es de agrupación; no acepta asientos`)
    totalDebit += debit; totalCredit += credit
  }
  if (Math.abs(round2(totalDebit) - round2(totalCredit)) > BALANCE_EPSILON) {
    throw new ValidationError(`El asiento no cuadra: débitos ${round2(totalDebit)} ≠ créditos ${round2(totalCredit)}`)
  }
  if (round2(totalDebit) <= 0) throw new ValidationError('El asiento no puede ser por monto cero')
}

/**
 * Crea un asiento (status `draft`) con sus líneas, atómico. Idempotente si trae reference+referenceType:
 * si ya existe un asiento con esa referencia (no revertido), lo devuelve sin duplicar.
 */
export async function createJournalEntry(
  deps: JournalDeps, hotelId: string, input: CreateEntryInput, createdBy?: string,
): Promise<{ id: string; deduped: boolean }> {
  // Dedup para conectores automáticos (CTB-4): mismo origen → un solo asiento.
  if (input.reference && input.referenceType) {
    const dup = await deps.entries.findMany({ hotelId, reference: input.reference, referenceType: input.referenceType })
    const alive = (dup as any[]).find((e) => e.status !== 'reversed')
    if (alive) return { id: alive.id, deduped: true }
  }
  if (!YMD.test(String(input.entryDate))) throw new ValidationError('entryDate debe ser YYYY-MM-DD')
  await validateLines(deps, hotelId, input.lines)

  const entryId = crypto.randomUUID()
  const period = String(input.entryDate).slice(0, 7)  // YYYY-MM
  await deps.orm.transaction(async (tx: any) => {
    await tx.create('JournalEntries', {
      id: entryId, hotelId, entryDate: input.entryDate, description: input.description ?? null,
      reference: input.reference ?? null, referenceType: input.referenceType ?? 'manual',
      period, status: 'draft', reversalOf: null, source: input.source ?? 'manual',
      createdBy: createdBy ?? null, postedAt: null,
    })
    for (const l of input.lines) {
      await tx.create('JournalLines', {
        id: crypto.randomUUID(), entryId, hotelId, accountId: l.accountId,
        debit: round2(Number(l.debit || 0)), credit: round2(Number(l.credit || 0)),
        description: l.description ?? null,
      })
    }
  })
  return { id: entryId, deduped: false }
}

/** Contabiliza un asiento (draft → posted). Un asiento ya posteado/revertido no se re-postea. */
export async function postEntry(deps: JournalDeps, id: string, hotelId: string): Promise<void> {
  const entry = await deps.entries.findOne({ id })
  if (!entry || entry.hotelId !== hotelId) throw new NotFoundError('Asiento no encontrado')
  if (entry.status !== 'draft') throw new ConflictError(`El asiento ya está ${entry.status}`)
  await deps.entries.update(id, { status: 'posted', postedAt: new Date().toISOString() })
}

/**
 * Revierte un asiento POSTEADO: crea un asiento espejo (debe↔haber) que lo anula, y marca el
 * original como `reversed`. Nunca se edita un posteado — esta es la única corrección.
 */
export async function reverseEntry(
  deps: JournalDeps, id: string, hotelId: string, createdBy?: string,
): Promise<{ reversalId: string }> {
  const entry = await deps.entries.findOne({ id })
  if (!entry || entry.hotelId !== hotelId) throw new NotFoundError('Asiento no encontrado')
  if (entry.status !== 'posted') throw new ConflictError('Solo se puede revertir un asiento posteado')
  const origLines = await deps.lines.findMany({ entryId: id })
  const reversalId = crypto.randomUUID()
  const now = new Date().toISOString()
  await deps.orm.transaction(async (tx: any) => {
    await tx.create('JournalEntries', {
      id: reversalId, hotelId, entryDate: now.slice(0, 10),
      description: `Reversión de ${entry.description ?? entry.id}`,
      reference: entry.reference ?? null, referenceType: 'reversal',
      period: now.slice(0, 7), status: 'posted', reversalOf: id, source: 'manual',
      createdBy: createdBy ?? null, postedAt: now,
    })
    for (const l of origLines as any[]) {
      await tx.create('JournalLines', {
        id: crypto.randomUUID(), entryId: reversalId, hotelId, accountId: l.accountId,
        debit: round2(Number(l.credit || 0)), credit: round2(Number(l.debit || 0)),  // invertido
        description: `Reversión: ${l.description ?? ''}`.trim(),
      })
    }
    await tx.update('JournalEntries', id, { status: 'reversed' })
  })
  return { reversalId }
}

/** Lista los asientos de un período con sus líneas. */
export async function listEntries(
  deps: JournalDeps, hotelId: string, period?: string,
): Promise<any[]> {
  const filter: Record<string, unknown> = { hotelId }
  if (period) filter.period = period
  const entries = await deps.entries.findMany(filter)
  const out: any[] = []
  for (const e of entries as any[]) {
    const lines = await deps.lines.findMany({ entryId: e.id })
    out.push({ ...e, lines })
  }
  return out
}
