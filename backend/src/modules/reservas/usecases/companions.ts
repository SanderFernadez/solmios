// reservas/usecases/companions.ts — CRUD de acompañantes (Companions).
// Lógica pura (sin HTTP). IDOR: create/update/delete verifican ownership vía la
// reservation padre (CR-27/CR-30). Extraído de composition-root (F2).

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { CompanionDTO, CreateCompanionDTO, UpdateCompanionDTO } from '../types'
import { assertReservationOwned, type SimpleUser } from './reservation-ownership'

export async function listCompanions(
  repo: RepositoryAdapter<CompanionDTO>,
  reservationId: string,
): Promise<CompanionDTO[]> {
  return repo.findMany({ reservationId })
}

export async function createCompanion(
  repo: RepositoryAdapter<CompanionDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  reservationId: string,
  dto: CreateCompanionDTO,
  user: SimpleUser,
): Promise<CompanionDTO> {
  // IDOR CR-30: verificar que la reservation pertenezca al hotel del user.
  // assertReservationOwned devuelve la reserva → reutilizamos su hotelId.
  const parent = await assertReservationOwned(reservationRepo, userRepo, auth, reservationId, user)
  // hotelId SÍ está declarado en el modelo Companions (shared/models.ts) y es required.
  // Persistirlo desde la reservation padre (fuente de verdad multi-tenant) — sin esto
  // la fila queda con hotelId NULL (mismo bug que lock_codes.hotelId, mem 1805).
  return repo.create({
    reservationId,
    hotelId: parent?.hotelId,
    name: dto.name,
    documentType: dto.documentType || 'passport',
    documentNumber: dto.documentNumber || '',
    nationality: dto.nationality || '',
    birthDate: dto.birthDate || '',
    isMainGuest: dto.isMainGuest ? 1 : 0,
  } as Omit<CompanionDTO, 'id'>)
}

async function assertCompanionOwned(
  repo: RepositoryAdapter<CompanionDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  id: string,
  user: SimpleUser,
): Promise<CompanionDTO> {
  const c = await repo.findById(id)
  if (!c) throw new NotFoundError('Companion no encontrado')
  // hotelId del companion; si falta (legacy creado sin hotelId), resolver vía la reservation padre.
  const hotelId = c.hotelId || ((await reservationRepo.findById(c.reservationId)) as any)?.hotelId
  const me = await userRepo.findById(user.id)
  auth.assertOwnership(hotelId, me?.hotelId ?? '', user.role, 'super_admin') // IDOR CR-27
  return c
}

export async function updateCompanion(
  repo: RepositoryAdapter<CompanionDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  id: string,
  dto: UpdateCompanionDTO,
  user: SimpleUser,
): Promise<CompanionDTO> {
  await assertCompanionOwned(repo, reservationRepo, userRepo, auth, id, user)
  const patch: Record<string, unknown> = {}
  for (const k of ['name', 'documentType', 'documentNumber', 'nationality', 'birthDate'] as (keyof UpdateCompanionDTO)[]) {
    if (dto[k] !== undefined) patch[k] = dto[k]
  }
  if (dto.isMainGuest !== undefined) patch.isMainGuest = dto.isMainGuest ? 1 : 0
  const updated = await repo.update(id, patch as Partial<CompanionDTO>)
  if (!updated) throw new NotFoundError('Companion no encontrado')
  return updated
}

export async function deleteCompanion(
  repo: RepositoryAdapter<CompanionDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  id: string,
  user: SimpleUser,
): Promise<void> {
  await assertCompanionOwned(repo, reservationRepo, userRepo, auth, id, user)
  await repo.delete(id)
}
