// treasury/usecases/bank.ts — Cuentas bancarias + movimientos + conciliación (TES-1).
// La conciliación matchea movimientos bancarios importados contra `payments` (fuente de verdad del
// dinero) por monto + fecha cercana. Multi-tenant + ownership.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'

export interface BankDeps {
  bankAccounts: RepositoryAdapter<any>
  bankMovements: RepositoryAdapter<any>
  payments: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}
interface User { id: string; hotelId?: string | null; role?: string }

const day = (d?: string) => String(d || '').slice(0, 10)
const MS_PER_DAY = 86_400_000
const RECONCILE_DAYS = 3   // tolerancia de fecha para dar un movimiento y un pago como el mismo

async function assertOwn(deps: BankDeps, hotelId: string, user: User): Promise<void> {
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
}
function hotelOf(user: User): string {
  const h = user.hotelId || ''
  if (!h && user.role !== 'super_admin') throw new ValidationError('Sin hotel asignado')
  return h
}

// ─── Cuentas bancarias ───
export async function listBankAccounts(deps: BankDeps, user: User) {
  const hotelId = hotelOf(user)
  return deps.bankAccounts.findMany(hotelId ? { hotelId } : {})
}
export async function createBankAccount(deps: BankDeps, dto: any, user: User) {
  const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
  if (!hotelId) throw new ValidationError('Sin hotel asignado')
  const opening = Number(dto.openingBalance || 0)
  return deps.bankAccounts.create({
    hotelId, name: dto.name, bank: dto.bank, accountNumber: dto.accountNumber,
    currency: dto.currency || 'USD', type: dto.type || 'checking',
    openingBalance: opening, currentBalance: opening, accountId: dto.accountId, active: 1,
  })
}
export async function updateBankAccount(deps: BankDeps, id: string, dto: any, user: User) {
  const existing = await deps.bankAccounts.findById(id)
  if (!existing) throw new NotFoundError('Cuenta bancaria no encontrada')
  await assertOwn(deps, existing.hotelId, user)
  const item = await deps.bankAccounts.update(id, dto)
  if (!item) throw new NotFoundError('Cuenta bancaria no encontrada')
  // DT-16: si cambió el saldo de apertura, currentBalance debe correrse el mismo delta —
  // sin esto quedaría calculado sobre un openingBalance viejo.
  if (dto.openingBalance !== undefined) return recalcBalance(deps, id)
  return item
}

/**
 * DT-16 — Recalcula `currentBalance` desde `openingBalance` + la suma de TODOS los movimientos
 * importados (ya vienen firmados: + entrada / − salida, ver `reconcile()`). Antes `currentBalance`
 * se seteaba UNA vez al crear la cuenta y nunca se volvía a tocar — quedaba permanentemente
 * desactualizado apenas se importaba el primer movimiento. La liquidez que ve el hotelero (cash
 * flow, AR/AP) NO depende de este campo — se computa aparte leyendo payments/expenses — así que
 * esto no cambia ningún número visible hoy; solo deja de mentir el campo `currentBalance` en sí
 * (relevante para exports/integraciones futuras que lo consulten directo).
 */
async function recalcBalance(deps: BankDeps, bankAccountId: string) {
  const acc = await deps.bankAccounts.findById(bankAccountId)
  if (!acc) throw new NotFoundError('Cuenta bancaria no encontrada')
  const movements = (await deps.bankMovements.findMany({ bankAccountId })) as any[]
  const sum = movements.reduce((s, m) => s + Number(m.amount || 0), 0)
  const currentBalance = Math.round((Number(acc.openingBalance || 0) + sum + Number.EPSILON) * 100) / 100
  const item = await deps.bankAccounts.update(bankAccountId, { currentBalance })
  if (!item) throw new NotFoundError('Cuenta bancaria no encontrada')
  return item
}

// ─── Movimientos ───
/** Importa movimientos (CSV parseado a array). Idempotente: dedup por cuenta+fecha+monto+referencia. */
export async function importMovements(deps: BankDeps, bankAccountId: string, rows: any[], user: User) {
  const acc = await deps.bankAccounts.findById(bankAccountId)
  if (!acc) throw new NotFoundError('Cuenta bancaria no encontrada')
  await assertOwn(deps, acc.hotelId, user)
  // La clave incluye la descripción: sin referencia, dos movimientos reales del mismo día y monto
  // (ej. dos consumos distintos) no se colapsan como duplicado. Re-importar el mismo CSV sí dedup.
  const dedupKey = (m: any) => `${day(m.date)}|${Number(m.amount || 0)}|${m.reference || ''}|${m.description || ''}`
  const existing = (await deps.bankMovements.findMany({ bankAccountId })) as any[]
  const seen = new Set(existing.map(dedupKey))
  let created = 0
  for (const r of rows || []) {
    const key = dedupKey(r)
    if (seen.has(key)) continue
    seen.add(key)
    await deps.bankMovements.create({
      hotelId: acc.hotelId, bankAccountId, date: day(r.date), description: r.description || '',
      amount: Number(r.amount || 0), reference: r.reference || '', reconciled: 0,
    })
    created++
  }
  // DT-16: recalcular currentBalance solo si entró algo nuevo (evita un update de más en un
  // re-import que dedup todo).
  if (created > 0) await recalcBalance(deps, bankAccountId)
  return { created, total: (rows || []).length }
}

/** Concilia: para cada movimiento sin conciliar, busca un pago del hotel con mismo monto y fecha
 *  cercana (±3 días). Si hay match, marca reconciled=1 + paymentId. Devuelve el resumen. */
export async function reconcile(deps: BankDeps, bankAccountId: string, user: User) {
  const acc = await deps.bankAccounts.findById(bankAccountId)
  if (!acc) throw new NotFoundError('Cuenta bancaria no encontrada')
  await assertOwn(deps, acc.hotelId, user)
  const movements = (await deps.bankMovements.findMany({ bankAccountId, reconciled: 0 })) as any[]
  const pays = ((await deps.payments.findMany({ hotelId: acc.hotelId })) as any[]).filter((p) => p.status === 'completed')
  // Un pago se concilia UNA sola vez, incluso ENTRE corridas: se siembra el set de pagos ya usados
  // con los paymentId de los movimientos ya conciliados de la cuenta. Sin esto, un pago consumido en
  // una corrida previa volvería a matchear un movimiento nuevo (el desajuste crecería con el tiempo).
  const reconciledBefore = (await deps.bankMovements.findMany({ bankAccountId, reconciled: 1 })) as any[]
  const usedPayment = new Set<string>(reconciledBefore.map((m) => m.paymentId).filter(Boolean))
  // Signo: el movimiento bancario viene firmado (+ entrada / − salida). Un cobro (charge/deposit) es
  // entrada (+), un reembolso/retiro es salida (−). Matchear por monto FIRMADO evita conciliar un
  // egreso contra un cobro entrante del mismo importe.
  const signedPay = (p: any) => (p.type === 'refund' || p.type === 'withdrawal' ? -1 : 1) * Math.abs(Number(p.amount || 0))
  let matched = 0
  const unmatched: any[] = []
  for (const m of movements) {
    const mAmt = Number(m.amount || 0)
    const mTime = new Date(day(m.date)).getTime()
    const hit = pays.find((p) => !usedPayment.has(p.id) && Math.abs(signedPay(p) - mAmt) < 0.005
      && Math.abs(new Date(day(p.processedAt || p.createdAt)).getTime() - mTime) <= RECONCILE_DAYS * MS_PER_DAY)
    if (hit) { usedPayment.add(hit.id); await deps.bankMovements.update(m.id, { reconciled: 1, paymentId: hit.id }); matched++ }
    else unmatched.push({ id: m.id, date: m.date, amount: m.amount, description: m.description })
  }
  return { matched, unmatched, unmatchedCount: unmatched.length }
}
