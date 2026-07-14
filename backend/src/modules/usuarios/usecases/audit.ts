// usuarios/usecases/audit.ts — Puerto de auditoría de usuarios (SC-05).
//
// `roles` ya auditaba la definición de un rol (qué permisos tiene), pero NO la asignación:
// cambiarle el rol a una persona vía PUT /api/usuarios/:id no dejaba rastro. Es el cambio de
// privilegios que de verdad importa — quién puede hacer qué, y quién se lo dio.
//
// El módulo no importa auditlog: declara el puerto y el connector `usuarios-auditlog` inyecta
// la implementación (regla del framework).

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

export type Actor = { id?: string; role?: string } | undefined

interface UserLike {
  id: string
  hotelId?: string | null
  name?: string
  email?: string
  role?: string
}

const who = (u: UserLike): string => u.email || u.name || u.id

/** Registra de QUÉ rol a QUÉ rol. Un "cambió el rol" sin los dos valores no sirve para auditar. */
export function roleChangeEntry(before: UserLike, newRole: string, actor: Actor): AuditEntry {
  return {
    hotelId: before.hotelId ?? undefined,
    userId: actor?.id,
    action: 'user.role_change',
    entity: 'user',
    entityId: before.id,
    detail: `${who(before)} · rol ${before.role ?? 'sin rol'} → ${newRole}`,
  }
}

export function userDeleteEntry(before: UserLike, actor: Actor): AuditEntry {
  return {
    hotelId: before.hotelId ?? undefined,
    userId: actor?.id,
    action: 'user.delete',
    entity: 'user',
    entityId: before.id,
    detail: `${who(before)} · rol ${before.role ?? 'sin rol'}`,
  }
}
