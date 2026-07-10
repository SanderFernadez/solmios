// shared/usecases/resolve-employee.ts — De quién es este fichaje.
//
// Fichar es una acción del propio empleado. El controller de attendance leía `req.userId`, que no
// existe (el usuario vive en `req.user.id`), así que sin `employeeId` en el body creaba registros
// con el campo vacío: basura en el reporte de asistencia.
//
// Y el `employeeId` del body no se validaba contra nadie. Ahora que todo el personal puede fichar,
// eso significaba que una camarera podía fichar por otra.

import { ForbiddenError, ValidationError } from 'arckode-framework'

export interface EmployeeProfileFinder {
  findMany(filters: Record<string, unknown>): Promise<Array<{ id: string }>>
}

export interface Actor {
  id?: string
  hotelId?: string
  permissions?: string[]
}

/** El perfil de empleado del usuario del token. `null` si el usuario no es un empleado. */
export async function resolveOwnEmployeeId(
  profiles: EmployeeProfileFinder,
  actor: Actor,
): Promise<string | null> {
  if (!actor.id) return null
  const filters: Record<string, unknown> = { userId: actor.id }
  if (actor.hotelId) filters.hotelId = actor.hotelId
  const rows = await profiles.findMany(filters)
  return rows[0]?.id ?? null
}

/**
 * A qué empleado se le imputa el fichaje.
 *
 * Sin `requested` es el del propio usuario. Fichar por otro es supervisión: exige `attendance:edit`.
 * Si el usuario no tiene perfil de empleado, falla en vez de escribir un registro huérfano.
 */
export async function resolveAttendanceTarget(
  profiles: EmployeeProfileFinder,
  actor: Actor,
  requested: string | undefined,
  canActForOthers: boolean,
): Promise<string> {
  const own = await resolveOwnEmployeeId(profiles, actor)

  if (!requested || requested === own) {
    if (!own) throw new ValidationError('Este usuario no tiene un perfil de empleado: no puede fichar')
    return own
  }

  if (!canActForOthers) throw new ForbiddenError('Solo podés fichar por vos mismo')
  return requested
}
