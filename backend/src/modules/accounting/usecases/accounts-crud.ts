// accounting/usecases/accounts-crud.ts — CRUD del plan de cuentas (CTB-0/CTB-1).
// Extraído del service para mantenerlo por debajo del límite de líneas (God Object). Misma lógica:
// ownership (IDOR), code único por hotel, jerarquía parentId validada, integridad en delete, cache versionada.
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { AccountDTO, CreateAccountDTO, UpdateAccountDTO, AccountsQuery, AccountsPaginated, CurrentUser } from '../types'
import type { AccountingSockets } from '../sockets'

export interface AccountsCrudDeps {
  accounts: RepositoryAdapter<AccountDTO>
  userRepo: RepositoryAdapter<any>
  cache: CacheAdapter
  auth: Auth
  lines: RepositoryAdapter<any>
  sockets: AccountingSockets
  state: { version: number }   // cache-busting versionado (se bumpa en cada mutación)
}

/** parentId (si viene) debe existir y ser del MISMO hotel. findOne (no findById) evita el falso IDOR. */
async function assertParent(deps: AccountsCrudDeps, parentId: string | undefined, hotelId: string): Promise<void> {
  if (!parentId) return
  const parent = await deps.accounts.findOne({ id: parentId })
  if (!parent || parent.hotelId !== hotelId) throw new ValidationError('La cuenta padre no existe o es de otro hotel')
}

export async function listAccounts(deps: AccountsCrudDeps, query: AccountsQuery | undefined, user: CurrentUser): Promise<AccountsPaginated> {
  const filters: Record<string, unknown> = {}
  if (user.role !== 'super_admin') filters.hotelId = user.hotelId ?? '__none__'
  else if (query?.hotelId) filters.hotelId = query.hotelId
  if (query?.type !== undefined) filters.type = query.type
  if (query?.active !== undefined) filters.active = Number(query.active)   // ?active=0 → INTEGER

  const page = Math.max(query?.page || 1, 1)
  const limit = Math.min(Math.max(query?.limit || 100, 1), 500)
  const offset = (page - 1) * limit
  const cacheKey = `accounting:accounts:v${deps.state.version}:${user.hotelId || 'all'}:${JSON.stringify(query || {})}`
  const cached = await deps.cache.get(cacheKey)
  if (cached) return cached as AccountsPaginated

  const result = await deps.accounts.paginate(filters, { offset, limit })
  const pages = limit > 0 ? Math.ceil(result.total / limit) : 0
  const response: AccountsPaginated = { data: result.data, total: result.total, limit, offset, pages, hasNext: page < pages, hasPrev: page > 1 }
  await deps.cache.set(cacheKey, response, 300)
  return response
}

export async function getAccount(deps: AccountsCrudDeps, id: string, user: CurrentUser): Promise<AccountDTO> {
  const item = await deps.accounts.findById(id)
  if (!item) throw new NotFoundError('Cuenta no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return item
}

export async function createAccount(deps: AccountsCrudDeps, dto: CreateAccountDTO, user: CurrentUser): Promise<AccountDTO> {
  const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
  if (!hotelId) throw new ValidationError('Sin hotel asignado')
  const dup = await deps.accounts.findMany({ hotelId, code: dto.code })
  if (dup.length > 0) throw new ConflictError(`Ya existe una cuenta con el código ${dto.code}`)
  await assertParent(deps, dto.parentId, hotelId)
  const item = await deps.accounts.create({ ...dto, hotelId, isPostable: dto.isPostable ?? 1, active: dto.active ?? 1 } as Omit<AccountDTO, 'id'>)
  await deps.sockets.onAccountCreated?.(item)
  deps.state.version++
  return item
}

export async function updateAccount(deps: AccountsCrudDeps, id: string, dto: UpdateAccountDTO, user: CurrentUser): Promise<AccountDTO> {
  const existing = await deps.accounts.findById(id)
  if (!existing) throw new NotFoundError('Cuenta no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  if (dto.parentId !== undefined) await assertParent(deps, dto.parentId, existing.hotelId)
  const item = await deps.accounts.update(id, dto as Partial<Omit<AccountDTO, 'id'>>)
  if (!item) throw new NotFoundError('Cuenta no encontrada')
  await deps.sockets.onAccountUpdated?.(item)
  deps.state.version++
  return item
}

export async function deleteAccount(deps: AccountsCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.accounts.findById(id)
  if (!existing) throw new NotFoundError('Cuenta no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  // No borrar una cuenta con hijos (huérfanos) ni con asientos (rompe el mayor): usar active=0.
  const children = await deps.accounts.findMany({ parentId: id })
  if (children.length > 0) throw new ConflictError('La cuenta tiene subcuentas; reasignalas o desactivá la cuenta (active=0)')
  const posted = await deps.lines.findMany({ accountId: id })
  if (posted.length > 0) throw new ConflictError('La cuenta tiene asientos; no se puede borrar (desactivala con active=0)')
  const deleted = await deps.accounts.delete(id)
  if (!deleted) throw new NotFoundError('Cuenta no encontrada')
  deps.state.version++
}
