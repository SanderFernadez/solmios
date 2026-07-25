// caja-chica/usecases/funds-crud.ts — CRUD de fondos de caja chica (PETTY-1).
// Multi-tenant + ownership. hotelId forzado del JWT (nunca del body). Clonado de suppliers-crud.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  PettyCashFundDTO, CreatePettyCashFundDTO, UpdatePettyCashFundDTO, CurrentUser,
} from '../types'

export interface FundsDeps {
  funds: RepositoryAdapter<PettyCashFundDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export async function listFunds(deps: FundsDeps, user: CurrentUser): Promise<PettyCashFundDTO[]> {
  const hotelId = user.role === 'super_admin' ? undefined : (user.hotelId ?? '__none__')
  return deps.funds.findMany(hotelId ? { hotelId } : {})
}

export async function createFund(
  deps: FundsDeps, dto: CreatePettyCashFundDTO, user: CurrentUser,
): Promise<PettyCashFundDTO> {
  const hotelId = user.role === 'super_admin'
    ? (dto.hotelId || user.hotelId || '')
    : (user.hotelId || '')
  if (!hotelId) throw new ValidationError('Sin hotel asignado')
  // Un fondo arranca con saldo 0: la reposición inicial lo fondea (ver usecases/replenish).
  // currentBalance NO viene del body — se persiste acá para evitar mass-assignment.
  return deps.funds.create({
    name: dto.name,
    custodianId: dto.custodianId,
    targetAmount: dto.targetAmount,
    currency: dto.currency ?? 'USD',
    active: dto.active ?? 1,
    notes: dto.notes,
    currentBalance: 0,
    hotelId,
  } as Omit<PettyCashFundDTO, 'id'>)
}

export async function updateFund(
  deps: FundsDeps, id: string, dto: UpdatePettyCashFundDTO, user: CurrentUser,
): Promise<PettyCashFundDTO> {
  const existing = await deps.funds.findById(id)
  if (!existing) throw new NotFoundError('Fondo de caja chica no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  // No permitir editar currentBalance desde acá: el saldo se mueve vía gasto/reposición.
  // Evita reescribir el saldo persistido por la espalda (descuadre silencioso).
  const { currentBalance: _ignored, ...safe } = dto as any
  void _ignored
  const item = await deps.funds.update(id, safe as Partial<Omit<PettyCashFundDTO, 'id'>>)
  if (!item) throw new NotFoundError('Fondo de caja chica no encontrado')
  return item
}

export async function deleteFund(
  deps: FundsDeps, id: string, user: CurrentUser,
): Promise<void> {
  const existing = await deps.funds.findById(id)
  if (!existing) throw new NotFoundError('Fondo de caja chica no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const deleted = await deps.funds.delete(id)
  if (!deleted) throw new NotFoundError('Fondo de caja chica no encontrado')
}

export async function getFund(
  deps: FundsDeps, id: string, user: CurrentUser,
): Promise<PettyCashFundDTO> {
  const existing = await deps.funds.findById(id)
  if (!existing) throw new NotFoundError('Fondo de caja chica no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return existing
}
