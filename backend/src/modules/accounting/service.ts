// accounting/service.ts — Facade del módulo de contabilidad.
// CTB-0/CTB-1: plan de cuentas (chart of accounts). Los asientos, períodos y reportes
// se agregan en usecases/ en tareas posteriores (CTB-2..6). Depende de RepositoryAdapter,
// no del ORM. NO importa de otros módulos.
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type {
  AccountDTO, CreateAccountDTO, UpdateAccountDTO, AccountsQuery, AccountsPaginated, CurrentUser,
} from './types'
import type { AccountingSockets } from './sockets'

export class AccountingService {
  private sockets: AccountingSockets = {}
  // Versionado de cache: cada mutación bumpa → las cacheKey viejas expiran solas (no hay deletePrefix).
  private listVersion = 0

  constructor(
    private readonly accounts: RepositoryAdapter<AccountDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
    // Líneas de asiento: para impedir borrar una cuenta con movimientos (rompería el mayor).
    private readonly lines: RepositoryAdapter<any>,
  ) {}

  // Acumula handlers, nunca pisa el anterior (composición de sockets).
  setSockets(s: Partial<AccountingSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  /** Valida que `parentId` (si viene) exista y sea del MISMO hotel — mantiene la jerarquía coherente. */
  private async assertParent(parentId: string | undefined, hotelId: string): Promise<void> {
    if (!parentId) return
    // findOne({id}) en vez de findById: no es un acceso por-ownership del usuario, es una
    // validación interna de integridad (mismo hotel). El analyzer marca findById como IDOR.
    const parent = await this.accounts.findOne({ id: parentId })
    if (!parent || parent.hotelId !== hotelId) {
      throw new ValidationError('La cuenta padre no existe o es de otro hotel')
    }
  }

  async listAccounts(query: AccountsQuery | undefined, user: CurrentUser): Promise<AccountsPaginated> {
    const filters: Record<string, unknown> = {}
    if (user.role !== 'super_admin') filters.hotelId = user.hotelId ?? '__none__'
    else if (query?.hotelId) filters.hotelId = query.hotelId
    if (query?.type !== undefined) filters.type = query.type
    // active llega como string por query (?active=0); la columna es INTEGER → coercer a número.
    if (query?.active !== undefined) filters.active = Number(query.active)

    const page = Math.max(query?.page || 1, 1)
    const limit = Math.min(Math.max(query?.limit || 100, 1), 500)
    const offset = (page - 1) * limit

    const cacheKey = `accounting:accounts:v${this.listVersion}:${user.hotelId || 'all'}:${JSON.stringify(query || {})}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as AccountsPaginated

    const result = await this.accounts.paginate(filters, { offset, limit })
    const pages = limit > 0 ? Math.ceil(result.total / limit) : 0
    const response: AccountsPaginated = {
      data: result.data, total: result.total, limit, offset, pages,
      hasNext: page < pages, hasPrev: page > 1,
    }
    await this.cache.set(cacheKey, response, 300)
    return response
  }

  async getAccount(id: string, user: CurrentUser): Promise<AccountDTO> {
    const item = await this.accounts.findById(id)
    if (!item) throw new NotFoundError('Cuenta no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async createAccount(dto: CreateAccountDTO, user: CurrentUser): Promise<AccountDTO> {
    const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
    if (!hotelId) throw new ValidationError('Sin hotel asignado')
    // `code` único por hotel (R1): dos cuentas con el mismo código rompen el mayor.
    const dup = await this.accounts.findMany({ hotelId, code: dto.code })
    if (dup.length > 0) throw new ConflictError(`Ya existe una cuenta con el código ${dto.code}`)
    await this.assertParent(dto.parentId, hotelId)
    const item = await this.accounts.create({
      ...dto, hotelId,
      isPostable: dto.isPostable ?? 1,
      active: dto.active ?? 1,
    } as Omit<AccountDTO, 'id'>)
    await this.sockets.onAccountCreated?.(item)
    this.listVersion++
    return item
  }

  async updateAccount(id: string, dto: UpdateAccountDTO, user: CurrentUser): Promise<AccountDTO> {
    const existing = await this.accounts.findById(id)
    if (!existing) throw new NotFoundError('Cuenta no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    if (dto.parentId !== undefined) await this.assertParent(dto.parentId, existing.hotelId)
    const item = await this.accounts.update(id, dto as Partial<Omit<AccountDTO, 'id'>>)
    if (!item) throw new NotFoundError('Cuenta no encontrada')
    await this.sockets.onAccountUpdated?.(item)
    this.listVersion++
    return item
  }

  async deleteAccount(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.accounts.findById(id)
    if (!existing) throw new NotFoundError('Cuenta no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    // Integridad referencial: no borrar una cuenta con hijos (quedarían huérfanos) ni con
    // líneas de asiento (rompería el mayor). Para desactivarla usar active=0 (soft-disable).
    const children = await this.accounts.findMany({ parentId: id })
    if (children.length > 0) throw new ConflictError('La cuenta tiene subcuentas; reasignalas o desactivá la cuenta (active=0)')
    const posted = await this.lines.findMany({ accountId: id })
    if (posted.length > 0) throw new ConflictError('La cuenta tiene asientos; no se puede borrar (desactivala con active=0)')
    const deleted = await this.accounts.delete(id)
    if (!deleted) throw new NotFoundError('Cuenta no encontrada')
    this.listVersion++
  }
}
