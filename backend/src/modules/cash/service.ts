// cash/service.ts — Facade pública del módulo Caja.
// Casos de uso: CRUD de movimientos, turnos (abrir/cerrar/arqueo), conciliación,
// y registerPaymentIncome (entrada del conector payments→caja con dedup por paymentId).
// NO sabe de HTTP. NO importa de otros módulos. Depende de RepositoryAdapter (no del ORM directo).

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  CashMovementDTO, CashShiftDTO, CreateMovementDTO, UpdateMovementDTO,
  MovementQuery, CashPaginated, OpenShiftDTO, CloseShiftDTO,
  ReconcileResult, CashStats, CurrentUser, MovementType,
} from './types'
import type { CashSockets } from './sockets'

const MOVEMENT_TYPES: MovementType[] = ['income', 'expense', 'opening', 'closing']
const MS_PER_DAY = 24 * 60 * 60 * 1000 // ms en un día — para rangos de stats

export class CashService {
  private sockets: CashSockets = {}
  // Versionado de cache: cada mutación bumpa → las cacheKey viejas dejan de matchear y expiran a 300s.
  private listVersion = 0

  constructor(
    private readonly repo: RepositoryAdapter<CashMovementDTO>,
    private readonly shiftRepo: RepositoryAdapter<CashShiftDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<CashSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]; if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  /** hotelId del JWT (super_admin puede especificar otro). Nunca confía en el body. */
  private hotelOfUser(user: CurrentUser, dtoHotelId?: string): string {
    if (user.role === 'super_admin') return dtoHotelId || user.hotelId || ''
    return user.hotelId || ''
  }

  // ─── Movimientos ───────────────────────────────────────
  async list(query: MovementQuery, user: CurrentUser): Promise<CashPaginated> {
    const hotelId = this.hotelOfUser(user, query.hotelId)
    const filters: Record<string, unknown> = { hotelId: hotelId || '__none__' }
    if (query.shiftId) filters.shiftId = query.shiftId
    if (query.type) filters.type = query.type
    if (query.method) filters.method = query.method

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const cacheKey = `caja:mov:v${this.listVersion}:${hotelId}:${JSON.stringify(query || {})}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as CashPaginated

    // El adapter no soporta range directo → filtramos fecha en memoria y paginamos después.
    let rows = await this.repo.findMany(filters)
    if (query.from) rows = rows.filter(r => (r.createdAt || '') >= query.from!)
    if (query.to) rows = rows.filter(r => (r.createdAt || '') <= query.to! + 'T23:59:59')
    const total = rows.length
    const data = rows.slice(offset, offset + limit)

    const response: CashPaginated = {
      data, total, limit, offset,
      pages: Math.ceil(total / limit) || 1,
      hasNext: offset + limit < total,
      hasPrev: page > 1,
    }
    await this.cache.set(cacheKey, response, 300)
    return response
  }

  async getById(id: string, user: CurrentUser): Promise<CashMovementDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Movimiento no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async create(dto: CreateMovementDTO, user: CurrentUser): Promise<CashMovementDTO> {
    if (!MOVEMENT_TYPES.includes(dto.type)) throw new Error(`Tipo de movimiento inválido: ${dto.type}`)
    const hotelId = this.hotelOfUser(user)
    // Asignar al turno abierto del hotel si existe (no obligatorio).
    const shiftId = await this.resolveOpenShift(hotelId)
    const item = await this.repo.create({
      ...dto, hotelId, shiftId: shiftId || null,
      category: dto.category || (dto.type === 'income' ? 'payment' : 'expense'),
      source: 'manual', createdBy: user.id,
    } as Omit<CashMovementDTO, 'id'>)
    await this.sockets.onCashMovementCreated?.(item)
    this.listVersion++
    return item
  }

  async update(id: string, dto: UpdateMovementDTO, user: CurrentUser): Promise<CashMovementDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Movimiento no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    // Integridad: los movimientos automáticos del conector no se editan a mano.
    if (existing.source === 'payment_connector') {
      throw new Error('Los movimientos automáticos (pago) no se pueden editar manualmente')
    }
    const item = await this.repo.update(id, dto as Partial<Omit<CashMovementDTO, 'id'>>)
    if (!item) throw new NotFoundError('Movimiento no encontrado')
    await this.sockets.onCashMovementUpdated?.(item)
    this.listVersion++
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Movimiento no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Movimiento no encontrado')
    await this.sockets.onCashMovementDeleted?.(id)
    this.listVersion++
  }

  /**
   * Conector payments→caja: registra un ingreso automático cuando un pago cash se completa.
   * Dedup por paymentId: si ya existe un movimiento para ese pago, no se duplica.
   * Best-effort: el conector envuelve en try/catch.
   */
  async registerPaymentIncome(input: {
    hotelId: string; paymentId: string; amount: number
    reservationId?: string; folioId?: string; method?: string; reference?: string
  }): Promise<CashMovementDTO | null> {
    const existing = await this.repo.findMany({ hotelId: input.hotelId, paymentId: input.paymentId } as any)
    if (existing.length > 0) {
      this.logger.info('registerPaymentIncome: ya registrado (dedup)', { paymentId: input.paymentId })
      return null
    }
    const shiftId = await this.resolveOpenShift(input.hotelId)
    const item = await this.repo.create({
      hotelId: input.hotelId, shiftId: shiftId || null,
      type: 'income', amount: input.amount, method: (input.method as any) || 'cash',
      concept: 'Pago automático', category: 'payment', source: 'payment_connector',
      reservationId: input.reservationId, folioId: input.folioId,
      paymentId: input.paymentId, reference: input.reference,
    } as Omit<CashMovementDTO, 'id'>)
    await this.sockets.onCashMovementCreated?.(item)
    this.listVersion++
    this.logger.info('registerPaymentIncome: ingreso creado', { paymentId: input.paymentId, amount: input.amount })
    return item
  }

  private async resolveOpenShift(hotelId: string): Promise<string | null> {
    if (!hotelId) return null
    const open = await this.shiftRepo.findMany({ hotelId, status: 'open' } as any)
    return open[0]?.id ?? null
  }

  // ─── Turnos ────────────────────────────────────────────
  async listShifts(hotelId: string | undefined, user: CurrentUser): Promise<CashShiftDTO[]> {
    const hid = this.hotelOfUser(user, hotelId)
    const shifts = await this.shiftRepo.findMany({ hotelId: hid || '__none__' } as any)
    return shifts.sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''))
  }

  async getCurrentShift(user: CurrentUser): Promise<CashShiftDTO | null> {
    const hotelId = this.hotelOfUser(user)
    const open = await this.shiftRepo.findMany({ hotelId: hotelId || '__none__', status: 'open' } as any)
    return open[0] ?? null
  }

  async openShift(dto: OpenShiftDTO, user: CurrentUser): Promise<CashShiftDTO> {
    const hotelId = this.hotelOfUser(user)
    const current = await this.getCurrentShift(user)
    if (current) throw new Error('Ya hay un turno abierto. Cerralo antes de abrir uno nuevo.')
    const now = new Date().toISOString()
    const opening = dto.openingAmount || 0
    const shift = await this.shiftRepo.create({
      hotelId, status: 'open', openingAmount: opening,
      openedBy: user.id, openedAt: now, notes: dto.notes,
      denominations: '{}', difference: 0, expectedAmount: opening,
    } as Omit<CashShiftDTO, 'id'>)
    await this.sockets.onShiftOpened?.(shift)
    this.listVersion++
    return shift
  }

  async closeShift(id: string, dto: CloseShiftDTO, user: CurrentUser): Promise<CashShiftDTO> {
    const shift = await this.shiftRepo.findById(id)
    if (!shift) throw new NotFoundError('Turno no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(shift.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    if (shift.status === 'closed') throw new Error('El turno ya está cerrado')

    const rec = await this.computeReconcile(shift)
    const now = new Date().toISOString()
    const updated = await this.shiftRepo.update(id, {
      status: 'closed', countedAmount: dto.countedAmount,
      expectedAmount: rec.expected, difference: dto.countedAmount - rec.expected,
      denominations: dto.denominations || '{}', closedBy: user.id, closedAt: now, notes: dto.notes,
    } as Partial<Omit<CashShiftDTO, 'id'>>)
    if (!updated) throw new NotFoundError('Turno no encontrado')
    await this.sockets.onShiftClosed?.(updated)
    this.listVersion++
    return updated
  }

  async reconcile(id: string, user: CurrentUser): Promise<ReconcileResult> {
    const shift = await this.shiftRepo.findById(id)
    if (!shift) throw new NotFoundError('Turno no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(shift.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return this.computeReconcile(shift)
  }

  private async computeReconcile(shift: CashShiftDTO): Promise<ReconcileResult> {
    const movs = shift.id ? await this.repo.findMany({ shiftId: shift.id } as any) : []
    let income = 0, expense = 0
    const byMethod: Record<string, number> = {}
    for (const m of movs) {
      if (m.type === 'income' || m.type === 'opening') income += m.amount
      else if (m.type === 'expense' || m.type === 'closing') expense += m.amount
      const mk = m.method || 'cash'
      byMethod[mk] = (byMethod[mk] || 0) + m.amount
    }
    const opening = shift.openingAmount || 0
    const expected = opening + income - expense
    const counted = shift.countedAmount ?? 0
    return { shift, opening, income, expense, expected, counted, difference: counted - expected, byMethod }
  }

  // ─── Stats ─────────────────────────────────────────────
  async stats(hotelId: string | undefined, user: CurrentUser): Promise<CashStats> {
    const hid = this.hotelOfUser(user, hotelId)
    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * MS_PER_DAY).toISOString()
    const monthAgo = new Date(Date.now() - 30 * MS_PER_DAY).toISOString()
    const movs = await this.repo.findMany({ hotelId: hid || '__none__' } as any)
    let todaySum = 0, weekSum = 0, monthSum = 0
    const byMethod: Record<string, number> = {}
    for (const m of movs) {
      if (m.type === 'expense' || m.type === 'closing') continue
      const c = m.createdAt || ''
      if (c.slice(0, 10) === today) todaySum += m.amount
      if (c >= weekAgo) weekSum += m.amount
      if (c >= monthAgo) monthSum += m.amount
      const mk = m.method || 'cash'
      byMethod[mk] = (byMethod[mk] || 0) + m.amount
    }
    return { today: todaySum, week: weekSum, month: monthSum, count: movs.length, byMethod }
  }
}
