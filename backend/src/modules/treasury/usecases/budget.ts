// treasury/usecases/budget.ts — Presupuesto + control de gastos (TES-5).
// budget-vs-actual compara lo presupuestado por categoría/período contra el gasto real (expenses).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'

export interface BudgetDeps {
  budgets: RepositoryAdapter<any>
  expenses: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}
interface User { id: string; hotelId?: string | null; role?: string }
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function hotelOf(user: User): string {
  const h = user.hotelId || ''
  if (!h && user.role !== 'super_admin') throw new ValidationError('Sin hotel asignado')
  return h
}

export async function listBudgets(deps: BudgetDeps, user: User, period?: string) {
  const hotelId = hotelOf(user)
  const filter: Record<string, unknown> = hotelId ? { hotelId } : {}
  if (period) filter.period = period
  return deps.budgets.findMany(filter)
}

export async function createBudget(deps: BudgetDeps, dto: any, user: User) {
  const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
  if (!hotelId) throw new ValidationError('Sin hotel asignado')
  if (!dto.period || !dto.category) throw new ValidationError('period y category son obligatorios')
  return deps.budgets.create({
    hotelId, period: dto.period, category: dto.category,
    budgetedAmount: Number(dto.budgetedAmount || 0), notes: dto.notes,
  })
}

export async function updateBudget(deps: BudgetDeps, id: string, dto: any, user: User) {
  const existing = await deps.budgets.findById(id)
  if (!existing) throw new NotFoundError('Presupuesto no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const patch: Record<string, unknown> = {}
  if (dto.budgetedAmount !== undefined) patch.budgetedAmount = Number(dto.budgetedAmount)
  if (dto.notes !== undefined) patch.notes = dto.notes
  const item = await deps.budgets.update(id, patch)
  if (!item) throw new NotFoundError('Presupuesto no encontrado')
  return item
}

/** Presupuestado vs real por categoría, para un período. Señala las categorías sobre-ejecutadas. */
export async function budgetVsActual(deps: BudgetDeps, user: User, period: string) {
  const hotelId = hotelOf(user)
  const budgets = (await deps.budgets.findMany(hotelId ? { hotelId, period } : { period })) as any[]
  const exps = (await deps.expenses.findMany(hotelId ? { hotelId } : {})) as any[]
  // Gasto real por categoría del período (expenses.date empieza con YYYY-MM).
  const actualByCat = new Map<string, number>()
  for (const e of exps) {
    if (String(e.date || '').slice(0, 7) !== period) continue
    const cat = e.category || 'general'
    actualByCat.set(cat, (actualByCat.get(cat) ?? 0) + Number(e.amount || 0))
  }
  const cats = new Set<string>([...budgets.map((b) => b.category), ...actualByCat.keys()])
  const rows = [...cats].map((category) => {
    const budgeted = round2(budgets.filter((b) => b.category === category).reduce((s, b) => s + Number(b.budgetedAmount || 0), 0))
    const actual = round2(actualByCat.get(category) ?? 0)
    const variance = round2(actual - budgeted)   // + = sobre-ejecutado
    const pct = budgeted > 0 ? round2((actual / budgeted) * 100) : null
    // Sobre-ejecutado también cuando NO hay presupuesto y hay gasto (descontrol sin partida asignada).
    return { category, budgeted, actual, variance, pctExecuted: pct, overBudget: actual > budgeted }
  }).sort((a, b) => a.category.localeCompare(b.category))
  return {
    period, rows,
    totalBudgeted: round2(rows.reduce((s, r) => s + r.budgeted, 0)),
    totalActual: round2(rows.reduce((s, r) => s + r.actual, 0)),
  }
}
