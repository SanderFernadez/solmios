// accounting/usecases/period.ts — Períodos contables mensuales (CTB-3).
// Un período `open` acepta asientos; `closed`/`locked` los rechazan. Cerrar valida que el
// balance de comprobación del período cuadra. Los asientos caen en el período de su entryDate.
import type { RepositoryAdapter, ORM } from 'arckode-framework'
import { NotFoundError, ConflictError, ValidationError } from 'arckode-framework'

export interface PeriodDeps {
  periods: RepositoryAdapter<any>
  entries: RepositoryAdapter<any>
  lines: RepositoryAdapter<any>
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Último día del mes de un período 'YYYY-MM' → 'YYYY-MM-DD'. */
function endOfMonth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()   // día 0 del mes siguiente = último del actual
  return `${period}-${String(last).padStart(2, '0')}`
}

/**
 * Garantiza que el período de un asiento acepta postings: si está `closed`/`locked`, rechaza;
 * si no existe, lo crea `open`. Se llama al crear un asiento (resuelve el período por entryDate).
 */
export async function assertAndEnsurePeriod(deps: PeriodDeps, hotelId: string, period: string): Promise<void> {
  const rows = await deps.periods.findMany({ hotelId, period })
  const row = rows[0]
  if (row) {
    if (row.status !== 'open') throw new ConflictError(`El período ${period} está ${row.status}; no acepta asientos`)
    return
  }
  await deps.periods.create({
    id: crypto.randomUUID(), hotelId, period,
    startDate: `${period}-01`, endDate: endOfMonth(period), status: 'open',
  })
}

/** Suma de débitos y créditos de los asientos POSTEADOS de un período (para validar cuadre). */
async function periodBalance(deps: PeriodDeps, hotelId: string, period: string): Promise<{ debit: number; credit: number }> {
  const entries = (await deps.entries.findMany({ hotelId, period })) as any[]
  let debit = 0, credit = 0
  for (const e of entries) {
    if (e.status !== 'posted') continue
    const ls = (await deps.lines.findMany({ entryId: e.id })) as any[]
    for (const l of ls) { debit += Number(l.debit || 0); credit += Number(l.credit || 0) }
  }
  return { debit: round2(debit), credit: round2(credit) }
}

/** Cierra un período (open → closed) tras validar que el balance de comprobación cuadra. */
export async function closePeriod(deps: PeriodDeps, hotelId: string, periodId: string, closedBy?: string): Promise<void> {
  const p = await deps.periods.findOne({ id: periodId })
  if (!p || p.hotelId !== hotelId) throw new NotFoundError('Período no encontrado')
  if (p.status !== 'open') throw new ConflictError(`El período ya está ${p.status}`)
  const bal = await periodBalance(deps, hotelId, p.period)
  if (Math.abs(bal.debit - bal.credit) > 0.005) {
    throw new ValidationError(`El período no cuadra: débitos ${bal.debit} ≠ créditos ${bal.credit}`)
  }
  await deps.periods.update(periodId, { status: 'closed', closedBy: closedBy ?? null, closedAt: new Date().toISOString() })
}

/** Bloquea un período de forma permanente (closed → locked). Solo un período CERRADO se bloquea:
 *  así no se congela un período descuadrado saltándose la validación de cierre (lifecycle). */
export async function lockPeriod(deps: PeriodDeps, hotelId: string, periodId: string): Promise<void> {
  const p = await deps.periods.findOne({ id: periodId })
  if (!p || p.hotelId !== hotelId) throw new NotFoundError('Período no encontrado')
  if (p.status !== 'closed') throw new ConflictError('Solo se puede bloquear un período cerrado (cerralo primero)')
  await deps.periods.update(periodId, { status: 'locked' })
}

export async function listPeriods(deps: PeriodDeps, hotelId: string): Promise<any[]> {
  return deps.periods.findMany({ hotelId })
}
