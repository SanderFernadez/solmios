// housekeeping/usecases/staff.ts — Validación del empleado asignado a una tarea.
//
// `staffId` es el id de un USUARIO (`users.id`), no el de un `employee_profile`.
// Así lo manda la app y lo compara `list()` contra `housekeeping.staffId`.
// Validarlo contra `employeeRepo` (otra PK) hacía fallar TODA asignación.

import type { RepositoryAdapter } from 'arckode-framework'
import { AuthError, ValidationError } from 'arckode-framework'
import type { HousekeepingUser } from '../types'

export async function assertStaffExists(
  userRepo: RepositoryAdapter<any>,
  staffId: string | undefined,
  currentUser: HousekeepingUser,
): Promise<void> {
  if (!staffId) return
  const staff = await userRepo.findById(staffId).catch(() => null)
  if (!staff) throw new ValidationError('staffId no corresponde a un empleado válido')
  if (currentUser.role !== 'super_admin' && staff.hotelId !== currentUser.hotelId) {
    throw new AuthError('staffId no pertenece a tu hotel')
  }
}

/**
 * Agrega `staffName` (nombre del usuario asignado) a cada tarea del lote.
 *
 * Las cards del supervisor/admin muestran quién limpia ("María · Limpieza · Piso 2").
 * `staffId` es un `users.id`; sin este join la app tenía que resolver el nombre por
 * su cuenta contra `/api/messages/contacts`, y si el id no estaba ahí quedaba en blanco.
 * `staffName` NO es columna de `housekeeping`: se agrega al leer, nunca a `create`/`update`
 * (el ORM lo descartaría en silencio). Mismo patrón que `withRoomInfo`.
 */
export async function withStaffInfo<T extends { staffId?: string; hotelId?: string }>(
  userRepo: RepositoryAdapter<any> | undefined,
  tasks: T[],
): Promise<Array<T & { staffName?: string }>> {
  // Sin `findMany` no se puede resolver el nombre: se devuelven las tareas tal cual
  // (mismo criterio que `withRoomInfo`: el enriquecimiento es best-effort).
  if (typeof userRepo?.findMany !== 'function' || tasks.length === 0) return tasks
  const staffIds = new Set(tasks.map((t) => t.staffId).filter(Boolean) as string[])
  if (staffIds.size === 0) return tasks
  // Una sola consulta acotada al hotel del lote (multi-tenant: el listado ya está
  // filtrado por hotelId, así que todas las tareas comparten hotel).
  const hotelId = tasks.find((t) => t.hotelId)?.hotelId
  const users = await userRepo.findMany(hotelId ? { hotelId } : {}).catch(() => [])
  const byId = new Map<string, any>(users.map((u: any) => [String(u.id), u]))
  return tasks.map((task) => {
    if (!task.staffId) return task
    const user = byId.get(String(task.staffId))
    return user ? { ...task, staffName: user.name ?? '' } : task
  })
}
