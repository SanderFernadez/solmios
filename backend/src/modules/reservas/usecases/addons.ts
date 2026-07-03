// reservas/usecases/addons.ts — CRUD de addons (ReservationAddons).
// Lógica pura. IDOR: create/delete verifican ownership vía la reservation padre
// (CR-28/CR-31). Extraído de composition-root (F2).

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { AddonDTO, CreateAddonDTO } from '../types'
import { assertReservationOwned, type SimpleUser } from './reservation-ownership'

export async function listAddons(
  repo: RepositoryAdapter<AddonDTO>,
  reservationId: string,
): Promise<AddonDTO[]> {
  return repo.findMany({ reservationId })
}

export async function createAddon(
  repo: RepositoryAdapter<AddonDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  reservationId: string,
  dto: CreateAddonDTO,
  user: SimpleUser,
): Promise<AddonDTO> {
  const res = await assertReservationOwned(reservationRepo, userRepo, auth, reservationId, user) // IDOR CR-31
  return repo.create({
    id: crypto.randomUUID(),
    reservationId,
    hotelId: res.hotelId,
    description: dto.description,
    kind: dto.kind === 'discount' ? 'discount' : 'service',
    amount: Number(dto.amount) || 0,
    quantity: Number(dto.quantity) || 1,
  } as Omit<AddonDTO, 'id'>)
}

async function assertAddonOwned(
  repo: RepositoryAdapter<AddonDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  id: string,
  user: SimpleUser,
): Promise<AddonDTO> {
  const a = await repo.findById(id)
  if (!a) throw new NotFoundError('Addon no encontrado')
  const hotelId = a.hotelId || ((await reservationRepo.findById(a.reservationId)) as any)?.hotelId
  const me = await userRepo.findById(user.id)
  auth.assertOwnership(hotelId, me?.hotelId ?? '', user.role, 'super_admin') // IDOR CR-28
  return a
}

export async function deleteAddon(
  repo: RepositoryAdapter<AddonDTO>,
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  id: string,
  user: SimpleUser,
): Promise<void> {
  await assertAddonOwned(repo, reservationRepo, userRepo, auth, id, user)
  await repo.delete(id)
}
