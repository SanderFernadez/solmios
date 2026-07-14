// usuarios/usecases/ownership.ts — Un usuario solo se toca si es del hotel del que lo pide.
//
// El controller ya valida esto antes de llamar al service, pero la regla vive acá también a
// propósito: el service es reutilizable (connectors, crons, tests) y no puede depender de que
// TODO caller se acuerde de chequear el hotel. Sin esto, un hotel_admin con el id de un usuario
// de otro hotel lo borra (IDOR).
//
// `super_admin` pasa por encima: es el dueño de la plataforma.

import type { RepositoryAdapter, Auth } from 'arckode-framework'

/**
 * Copia solo las claves presentes en `data`. Un campo ausente NO es un campo a borrar.
 *
 * Sin esto, `({ name, email }) => ({ name, email })` sobre `{ role: 'x' }` devuelve
 * `{ name: undefined, email: undefined }`, y el ORM los persiste como NULL.
 */
export function pickDefined<T extends Record<string, any>>(data: T, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of keys) {
    if (data?.[k] !== undefined) out[k] = data[k]
  }
  return out
}

export async function assertOwnership(
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  resourceHotelId: string,
  callerId: string,
  role?: string,
): Promise<void> {
  const me = await userRepo.findById(callerId)
  auth.assertOwnership(resourceHotelId, me?.hotelId ?? '', role, 'super_admin')
}
