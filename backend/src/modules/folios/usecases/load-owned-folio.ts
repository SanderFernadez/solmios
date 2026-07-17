// folios/usecases/load-owned-folio.ts — Carga un folio y exige ownership del hotel antes de devolverlo.
//
// Patrón común a FoliosService.getById / close / setInvoice: findById -> 404 si no existe ->
// resolver hotelId del usuario -> assertOwnership (lanza 403 si no es del hotel o no es super_admin).
// Extraído a usecase para evitar duplicar el chequeo de seguridad (IDOR) en cada consumidor.

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { FolioDTO, CurrentUser } from '../types'

export async function loadOwnedFolio(
  folioRepo: RepositoryAdapter<FolioDTO>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  id: string,
  user: CurrentUser,
): Promise<FolioDTO> {
  const folio = await folioRepo.findById(id)
  if (!folio) throw new NotFoundError('Folio no encontrado')
  const me = await userRepo.findById(user.id)
  auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
  return folio
}
