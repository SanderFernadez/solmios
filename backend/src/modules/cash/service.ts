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
import { registerPaymentIncome, registerExpenseOutflow, removeExpenseOutflow } from './usecases/auto-movements'
import type { AutoMovementDeps, PaymentIncomeInput, ExpenseOutflowInput } from './usecases/auto-movements'
import { listMovements } from './usecases/list'
import {
  auditSafely, movementDeleteEntry, shiftOpenEntry, shiftCloseEntry, shiftReconcileEntry,
  type AuditEntry, type AuditPort,
} from './usecases/audit'

const MOVEMENT_TYPES: MovementType[] = ['income', 'expense', 'opening', 'closing']

export class CashService {
  private sockets: CashSockets = {}
  private listVersion = 0 // cache versioning: mutaciones bump → cacheKey viejas expiran a 300s
  private auditPort: AuditPort | null = null

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

  /** Conecta el audit log. Lo inyecta el connector `cash-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  private audit(entry: AuditEntry): Promise<void> {
    return auditSafely(this.auditPort, this.logger, entry)
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

  private autoDeps(): AutoMovementDeps {
    return {
      repo: this.repo, logger: this.logger,
      resolveShift: (hotelId) => shiftsUc.resolveOpenShift(this.shiftDeps(), hotelId),
      onCreated: async (m) => { await this.sockets.onCashMovementCreated?.(m) },
      onDeleted: async (id) => { await this.sockets.onCashMovementDeleted?.(id) },
    }
  }

  // ─── Movimientos ───────────────────────────────────────
  async list(query: MovementQuery, user: CurrentUser): Promise<CashPaginated> {
    const hotelId = this.hotelOfUser(user, query.hotelId)
    return listMovements({ repo: this.repo, cache: this.cache, version: this.listVersion }, hotelId, query)
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
    if (existing.source === 'expense_connector') {
      throw new Error('Los movimientos automáticos (gasto) no se editan acá: modificá el gasto')
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
    await this.audit(movementDeleteEntry(existing, user))
  }

  // ─── Movimientos automáticos (delegan a usecases/auto-movements) ──
  /** Conector payments→caja: ingreso por pago cash. Dedup por paymentId. */
  async registerPaymentIncome(input: PaymentIncomeInput): Promise<CashMovementDTO | null> {
    const item = await registerPaymentIncome(this.autoDeps(), input)
    if (item) this.listVersion++
    return item
  }

  /** Conector gastos→caja: egreso por gasto en efectivo. Dedup por expenseId. */
  async registerExpenseOutflow(input: ExpenseOutflowInput): Promise<CashMovementDTO | null> {
    const item = await registerExpenseOutflow(this.autoDeps(), input)
    if (item) this.listVersion++
    return item
  }

  /** Conector gastos→caja: revierte el egreso (gasto borrado, impago, o ya no en efectivo). */
  async removeExpenseOutflow(expenseId: string): Promise<boolean> {
    const removed = await removeExpenseOutflow(this.autoDeps(), expenseId)
    if (removed) this.listVersion++
    return removed
  }

  // ─── Turnos (delegan a usecases/shifts) ────────────────
  listShifts(hotelId: string | undefined, user: CurrentUser) { return shiftsUc.listShifts(this.shiftDeps(), hotelId, user) }
  getCurrentShift(user: CurrentUser) { return shiftsUc.getCurrentShift(this.shiftDeps(), user) }

  async openShift(dto: OpenShiftLike, user: CurrentUser) {
    const shift = await shiftsUc.openShift(this.shiftDeps(), dto, user)
    await this.audit(shiftOpenEntry(shift, user))
    return shift
  }

  async closeShift(id: string, dto: CloseShiftLike, user: CurrentUser) {
    const shift = await shiftsUc.closeShift(this.shiftDeps(), id, dto, user)
    await this.audit(shiftCloseEntry(shift, user))
    return shift
  }

  async reconcile(id: string, user: CurrentUser) {
    const result = await shiftsUc.reconcile(this.shiftDeps(), id, user)
    await this.audit(shiftReconcileEntry(result, user))
    return result
  }

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
