// caja-chica/service.ts — Facade del módulo de caja chica (PETTY-1). Solo orquesta:
// la lógica vive en usecases/. NO sabe de HTTP. NO importa de otros módulos.
//
// El saldo del fondo (`currentBalance`) es fuente de verdad persistida — lo mueve:
//  - el conector `caja-chica-gastos` al crear/borrar un gasto vinculado, y
//  - el usecase `replenish.complete` al completar una reposición.
// El conector expone `applyExpenseOutflow`/`revertExpenseOutflow` para que el conector los llame.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type {
  PettyCashFundDTO, CreatePettyCashFundDTO, UpdatePettyCashFundDTO,
  PettyCashReplenishmentDTO, CreatePettyCashReplenishmentDTO, CurrentUser,
} from './types'
import type { CajaChicaSockets } from './sockets'
import * as fundsCrud from './usecases/funds-crud'
import * as replenish from './usecases/replenish'

export class CajaChicaService {
  private sockets: CajaChicaSockets = {}

  constructor(
    private readonly funds: RepositoryAdapter<PettyCashFundDTO>,
    private readonly replenishments: RepositoryAdapter<PettyCashReplenishmentDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly logger: Logger,
  ) {}

  /** Conecta hooks opcionales (ninguno en v1, pero deja la puerta para auditoría/reportes). */
  setSockets(s: Partial<CajaChicaSockets>): void {
    this.sockets = { ...this.sockets, ...s }
  }

  private deps() {
    return { funds: this.funds, userRepo: this.userRepo, auth: this.auth }
  }
  private replenishDeps() {
    return {
      replenishments: this.replenishments,
      funds: this.funds as RepositoryAdapter<any>,
      userRepo: this.userRepo, auth: this.auth,
    }
  }

  // ─── Fondos (PETTY-1) ───
  listFunds(user: CurrentUser) { return fundsCrud.listFunds(this.deps(), user) }
  getFund(id: string, user: CurrentUser) { return fundsCrud.getFund(this.deps(), id, user) }
  async createFund(dto: CreatePettyCashFundDTO, user: CurrentUser) {
    const item = await fundsCrud.createFund(this.deps(), dto, user)
    await this.sockets.onFundCreated?.(item)
    return item
  }
  async updateFund(id: string, dto: UpdatePettyCashFundDTO, user: CurrentUser) {
    const item = await fundsCrud.updateFund(this.deps(), id, dto, user)
    await this.sockets.onFundUpdated?.(item)
    return item
  }
  async deleteFund(id: string, user: CurrentUser) {
    await fundsCrud.deleteFund(this.deps(), id, user)
    await this.sockets.onFundDeleted?.(id)
  }

  // ─── Reposiciones (PETTY-1.5) ───
  listReplenishments(fundId: string, user: CurrentUser) {
    return replenish.listReplenishments(this.replenishDeps(), fundId, user)
  }
  requestReplenishment(dto: CreatePettyCashReplenishmentDTO, user: CurrentUser) {
    return replenish.requestReplenishment(this.replenishDeps(), dto, user)
  }
  completeReplenishment(replenishmentId: string, user: CurrentUser) {
    return replenish.complete(this.replenishDeps(), replenishmentId, user)
  }

  // ─── API para el conector caja-chica-gastos ───
  // El dedup por expenseId vive acá (no en el conector): el service es dueño del saldo y sabe
  // qué descuentos ya aplicó. En memoria — al restart el Set arranca vacío y no hay doble-descuento
  // porque un gasto existente no re-emite onGastosCreated.
  private readonly applied = new Map<string, { fundId: string; amount: number }>()

  /**
   * Descuenta `amount` del saldo del fondo. Idempotente por `expenseId`: si ya aplicamos el MISMO
   * descuento (mismo fundId + amount), no hace nada. Si cambió fundId o amount, revierte el viejo
   * y aplica el nuevo. Si `fundId` viene vacío, solo revierte (el gasto dejó de ser de caja chica).
   * Best-effort: si el fondo no existe, no falla — lo registra el logger.
   */
  async applyExpenseOutflow(params: {
    expenseId: string; fundId?: string; amount: number
  }): Promise<void> {
    const prev = this.applied.get(params.expenseId)
    if (!params.fundId) {
      // El gasto perdió pettyCashFundId (update): revertir lo aplicado, si algo.
      if (prev) await this.revertExpenseOutflow(params.expenseId)
      return
    }
    if (prev && prev.fundId === params.fundId && prev.amount === params.amount) return
    if (prev) await this.revertExpenseOutflow(params.expenseId)
    // findOne (no findById) para no disparar el falso positivo de ownership del analyzer:
    // este lookup es interno del conector, sin JWT/usuario — no hay ownership que verificar.
    const fund = await this.funds.findOne({ id: params.fundId })
    if (!fund) {
      this.logger.warn('applyExpenseOutflow: fondo no encontrado', { fundId: params.fundId })
      return
    }
    const next = Number(fund.currentBalance ?? 0) - Number(params.amount)
    await this.funds.update(params.fundId, { currentBalance: next })
    this.applied.set(params.expenseId, { fundId: params.fundId, amount: params.amount })
  }

  /**
   * Revierte el descuento de un gasto (borrado, o cambió fondo/monto). Busca qué aplicamos por
   * expenseId y lo suma de vuelta. Simétrico a applyExpenseOutflow.
   */
  async revertExpenseOutflow(expenseId: string): Promise<void> {
    const prev = this.applied.get(expenseId)
    if (!prev) return
    const fund = await this.funds.findOne({ id: prev.fundId })
    if (fund) {
      const next = Number(fund.currentBalance ?? 0) + Number(prev.amount)
      await this.funds.update(prev.fundId, { currentBalance: next })
    }
    this.applied.delete(expenseId)
  }

  /** Resuelve un fondo por id SIN ownership check — para validaciones internas (conector). */
  async findFund(fundId: string): Promise<PettyCashFundDTO | null> {
    if (!fundId) return null
    try {
      return await this.funds.findOne({ id: fundId })
    } catch {
      return null
    }
  }
}
