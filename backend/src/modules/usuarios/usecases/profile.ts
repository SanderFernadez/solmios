// usuarios/usecases/profile.ts — El perfil del propio usuario del token.
//
// Nunca recibe un id de otro: quien llama pasa `req.user.id`. Por eso estas
// operaciones no piden `users:view`/`users:edit`, que son los permisos para
// mirar o tocar a OTROS. Sin esto, una camarera no podía ni ver su nombre.

import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import { toStoredPhone } from './normalize-phone'

/** Lo que la app puede cambiar de sí misma. */
export interface ProfilePatch {
  name?: string
  phone?: string
  avatar?: string | null
}

const MIN_NAME_LENGTH = 2

/** El perfil visible: nunca password, token ni los campos de reset. */
export async function getProfile(
  repo: RepositoryAdapter<any>,
  hotelRepo: RepositoryAdapter<any> | undefined,
  userId: string,
): Promise<Record<string, unknown>> {
  // @ignore IDOR_RISK — `userId` sale del JWT (req.user.id), es un self-lookup.
  const u = await repo.findById(userId)
  if (!u) throw new NotFoundError('Usuario no encontrado')

  let hotelName = ''
  if (u.hotelId && hotelRepo) {
    try {
      // @ignore IDOR_RISK — `hotelId` sale del registro propio del usuario.
      const hotel = await hotelRepo.findById(u.hotelId)
      hotelName = (hotel as any)?.name || ''
    } catch {
      // El perfil sirve igual sin el nombre del hotel.
    }
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '',
    avatar: u.avatar ?? null,
    role: u.role,
    userType: u.userType ?? 'merchant',
    hotelId: u.hotelId,
    hotelName,
  }
}

/**
 * Edita el perfil propio.
 *
 * Solo `name`, `phone` y `avatar`. `role` y `hotelId` quedan afuera porque
 * cambiarlos sería escalar privilegios o saltar de hotel; `email` es la
 * credencial de login; `password` tiene su endpoint, que exige la actual.
 */
export async function updateProfile(
  repo: RepositoryAdapter<any>,
  hotelRepo: RepositoryAdapter<any> | undefined,
  userId: string,
  data: ProfilePatch,
): Promise<Record<string, unknown>> {
  // @ignore IDOR_RISK — `userId` sale del JWT (req.user.id), es un self-update.
  const user = await repo.findById(userId)
  if (!user) throw new NotFoundError('Usuario no encontrado')

  const patch: Record<string, unknown> = {}

  if (data.name !== undefined) {
    const name = String(data.name).trim()
    if (name.length < MIN_NAME_LENGTH) throw new ValidationError('El nombre es demasiado corto')
    patch.name = name
  }
  // Mismo formato que el login espera: dígitos planos, sin separadores.
  if (data.phone !== undefined) Object.assign(patch, toStoredPhone(data.phone))

  // Cadena vacía = quitar la foto. Un `null` en el JSON no sobrevive al
  // validador (el campo se declara `string`), así que sin esto no había forma
  // de borrarla una vez subida.
  if (data.avatar !== undefined) patch.avatar = data.avatar === '' ? null : data.avatar

  if (Object.keys(patch).length > 0) await repo.update(userId, patch)
  return getProfile(repo, hotelRepo, userId)
}
