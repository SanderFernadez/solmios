// caja-chica/usecases/replenish.ts — Reposiciones de caja chica (PETTY-1.5).
// Workflow v1: `requested → completed` (la completa el admin a mano). Al completar,
// `fund.currentBalance += amount`. v2 integrará banco + contabilidad (ver proposal.md).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ForbiddenError } from 'arckode-framework'
import type {
  PettyCashReplenishmentDTO, CreatePettyCashReplenishmentDTO, CurrentUser,
} from '../types'

export interface ReplenishDeps {
  replenishments: RepositoryAdapter<PettyCashReplenishmentDTO>
  funds: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export async function listReplenishments(
  deps: ReplenishDeps, fundId: string, user: CurrentUser,
): Promise<PettyCashReplenishmentDTO[]> {
  const existing = await deps.funds.findById(fundId)
  if (!existing) throw new NotFoundError('Fondo de caja chica no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return deps.replenishments.findMany({ fundId })
}

export async function requestReplenishment(
  deps: ReplenishDeps, dto: CreatePettyCashReplenishmentDTO, user: CurrentUser,
): Promise<PettyCashReplenishmentDTO> {
  const fund = await deps.funds.findById(dto.fundId)
  if (!fund) throw new NotFoundError('Fondo de caja chica no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(fund.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const hotelId = user.role === 'super_admin'
    ? (dto.hotelId || user.hotelId || fund.hotelId || '')
    : (user.hotelId || fund.hotelId || '')
  if (!hotelId) throw new ValidationError('Sin hotel asignado')
  return deps.replenishments.create({
    fundId: dto.fundId,
    amount: dto.amount,
    sourceBankAccountId: dto.sourceBankAccountId,
    notes: dto.notes,
    status: 'requested',
    requestedBy: user.id,
    hotelId,
  } as Omit<PettyCashReplenishmentDTO, 'id'>)
}

/**
 * Completa una reposición: `requested → completed` y bumpa `fund.currentBalance += amount`.
 * v1 NO mueve dinero real (banco/contabilidad) — la reposición es lógica hasta v2.
 *
 * Idempotencia: solo se puede completar desde `requested`. Un segundo `complete` lanza 409
 * (evita doble-acreditación del saldo).
 */
export async function complete(
  deps: ReplenishDeps, replenishmentId: string, user: CurrentUser,
): Promise<PettyCashReplenishmentDTO> {
  const rep = await deps.replenishments.findById(replenishmentId)
  if (!rep) throw new NotFoundError('Reposición no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(rep.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')

  if (rep.status === 'completed') {
    // Doble complete = doble_acreditación del saldo. Bloquear.
    throw new ForbiddenError('La reposición ya fue completada')
  }
  if (rep.status === 'cancelled') {
    throw new ValidationError('No se puede completar una reposición cancelada')
  }

  // 1. Marcar completed ANTES de tocar el saldo: si el update del fondo fallara, no queremos
  //    volver a acreditar al reintentar. El status es el gate de idempotencia.
  const updated = await deps.replenishments.update(replenishmentId, {
    status: 'completed',
    approvedBy: user.id,
  } as Partial<Omit<PettyCashReplenishmentDTO, 'id'>>)
  if (!updated) throw new NotFoundError('Reposición no encontrada')

  // 2. Bumpear el saldo del fondo. currentBalance es persistido (como bank_accounts).
  const fund = await deps.funds.findById(rep.fundId)
  if (fund) {
    const next = Number(fund.currentBalance ?? 0) + Number(rep.amount)
    await deps.funds.update(rep.fundId, { currentBalance: next })
  }

  return updated
}
