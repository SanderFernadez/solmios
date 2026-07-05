// cash/service.ts — Facade del módulo Caja. Orquestador delgado.
// Movimientos CRUD + registerPaymentIncome aquí; turnos y stats delegan a ./usecases/.
// Depende de RepositoryAdapter (no del ORM directo). hotelId forzado del JWT en create (P0 IDOR).

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  CashMovementDTO, CashShiftDTO, CreateMovementDTO, UpdateMovementDTO,
  MovementQuery, CashPaginated, CurrentUser, MovementType,
} from './types'
import type { CashSockets } from './sockets'
import { computeStats } from './usecases/stats'
import * as shiftsUc from './usecases/shifts'
import type { ShiftDeps } from './usecases/shifts'

const MOVEMENT_TYPES: MovementType[] = ['income', 'expense', 'opening', 'closing']

export class CashService {
  private sockets: CashSockets = {}
  private listVersion = 0 // cache versioning: mutaciones bump → cacheKey viejas expiran a 300s

  constructor(
    private readonly repo: RepositoryAdapter<CashMovementDTO>,
    private readonly shiftRepo: RepositoryAdapter<CashShiftDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<CashSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]; if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  private hotelOfUser(user: CurrentUser, dtoHotelId?: string): string {
    if (user.role === 'super_admin') return dtoHotelId || user.hotelId || ''
    return user.hotelId || ''
  }

  private shiftDeps(): ShiftDeps {
    return {
      shiftRepo: this.shiftRepo, repo: this.repo, userRepo: this.userRepo,
      auth: this.auth, logger: this.logger, sockets: this.sockets,
      hotelOfUser: (u, h) => this.hotelOfUser(u, h),
      bumpVersion: () => { this.listVersion++ },
    }
  }

  // ─── Movimientos ───────────────────────────────────────
  async list(query: MovementQuery, user: CurrentUser): Promise<CashPaginated> {
    const hotelId = this.hotelOfUser(user, query.hotelId)
    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const cacheKey = `caja:mov:v${this.listVersion}:${hotelId}:${JSON.stringify(query || {})}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as CashPaginated

    const isDateFilter = query.from || query.to
    if (isDateFilter) {
      const filters: Record<string, unknown> = { hotelId: hotelId || '__none__' }
      if (query.shiftId) filters.shiftId = query.shiftId
      if (query.type) filters.type = query.type
      if (query.method) filters.method = query.method
      let rows = await this.repo.findMany(filters)
      if (query.from) rows = rows.filter(r => (r.createdAt || '') >= query.from!)
      if (query.to) rows = rows.filter(r => (r.createdAt || '') <= query.to! + 'T23:59:59')
      const total = rows.length
      const data = rows.slice(offset, offset + limit)
      const response: CashPaginated = { data, total, limit, offset, pages: Math.ceil(total / limit) || 1, hasNext: offset + limit < total, hasPrev: page > 1 }
      await this.cache.set(cacheKey, response, 300)
      return response
    }

    const filters: Record<string, unknown> = { hotelId: hotelId || '__none__' }
    if (query.shiftId) filters.shiftId = query.shiftId
    if (query.type) filters.type = query.type
    if (query.method) filters.method = query.method
    const result = await this.repo.paginate(filters, { limit, offset })
    const response: CashPaginated = {
      data: result.data, total: result.total, limit, offset,
      pages: result.pages, hasNext: offset + limit < result.total, hasPrev: page > 1,
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
    const shiftId = await shiftsUc.resolveOpenShift(this.shiftDeps(), hotelId)
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

  /** Conector payments→caja: ingreso automático por pago cash. Dedup por paymentId. */
  async registerPaymentIncome(input: {
    hotelId: string; paymentId: string; amount: number
    reservationId?: string; folioId?: string; method?: string; reference?: string
  }): Promise<CashMovementDTO | null> {
    const existing = await this.repo.findMany({ hotelId: input.hotelId, paymentId: input.paymentId } as any)
    if (existing.length > 0) {
      this.logger.info('registerPaymentIncome: ya registrado (dedup)', { paymentId: input.paymentId })
      return null
    }
    const shiftId = await shiftsUc.resolveOpenShift(this.shiftDeps(), input.hotelId)
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

  // ─── Turnos (delegan a usecases/shifts) ────────────────
  listShifts(hotelId: string | undefined, user: CurrentUser) { return shiftsUc.listShifts(this.shiftDeps(), hotelId, user) }
  getCurrentShift(user: CurrentUser) { return shiftsUc.getCurrentShift(this.shiftDeps(), user) }
  openShift(dto: OpenShiftLike, user: CurrentUser) { return shiftsUc.openShift(this.shiftDeps(), dto, user) }
  closeShift(id: string, dto: CloseShiftLike, user: CurrentUser) { return shiftsUc.closeShift(this.shiftDeps(), id, dto, user) }
  reconcile(id: string, user: CurrentUser) { return shiftsUc.reconcile(this.shiftDeps(), id, user) }

  // ─── Stats ─────────────────────────────────────────────
  async stats(hotelId: string | undefined, user: CurrentUser) {
    const hid = this.hotelOfUser(user, hotelId)
    const movs = await this.repo.findMany({ hotelId: hid || '__none__' } as any)
    return computeStats(movs, Date.now())
  }
}

// Alias de tipos de los usecases para firmas delgadas (sin importar Parameters<> que ensucia).
type OpenShiftLike = { openingAmount?: number; notes?: string }
type CloseShiftLike = { countedAmount: number; denominations?: string; notes?: string }
