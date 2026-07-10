// shared/usecases/role-sync.ts — Sincroniza los roles de sistema con DEFAULT_ROLE_PERMISSIONS.
//
// El problema: `loadPermissions` lee la tabla `roles` y sus permisos PISAN el mapa estático. Como
// `seed-default-roles.ts` hace `ON CONFLICT DO NOTHING`, un rol sembrado queda congelado con el
// default del día que se creó. Cambiar `permissions.ts` no tiene ningún efecto en producción.
//
// Refrescar a ciegas no sirve: en producción un `receptionist` tiene 15 permisos y otro 2. El
// segundo está personalizado, y pisarlo le rompería la configuración a alguien. `system = 1` NO
// significa "no personalizado".
//
// La solución es `defaultsHash`: la huella de los permisos que ESTE script escribió. Si los permisos
// actuales todavía hashean a ese valor, nadie los tocó desde el último sync → es seguro refrescar.
// Si difieren, alguien los editó → no se tocan.
//
// Las filas viejas no tienen huella. Si sus permisos ya son el default actual, se les estampa la
// huella (no cambia nada). Si difieren, no hay forma de distinguir "default viejo" de
// "personalizado": se reportan para revisión y NO se tocan.

import { createHash } from 'node:crypto'

export type SyncAction =
  | 'update'        // nadie lo tocó desde el último sync: se refresca al default nuevo
  | 'stamp'         // ya es el default actual: solo se guarda la huella
  | 'up-to-date'    // es el default actual y ya tiene la huella
  | 'skip-custom'   // alguien lo editó: no se toca
  | 'skip-unknown'  // no es un rol de sistema, o no existe en el mapa
  | 'review'        // fila vieja sin huella y con permisos distintos: decide un humano

export interface RoleRow {
  id: string
  name: string
  system: number
  hotelId?: string | null
  permissions: string[]
  defaultsHash?: string | null
}

export interface RolePlan {
  role: RoleRow
  action: SyncAction
  reason: string
  nextPermissions?: string[]
  nextHash?: string
}

/** Huella estable: el orden de los permisos no importa, el conjunto sí. */
export function permissionsHash(permissions: string[]): string {
  const canonical = [...permissions].sort().join('\n')
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && permissionsHash(a) === permissionsHash(b)

export function planRoleSync(rows: RoleRow[], defaults: Record<string, string[]>): RolePlan[] {
  return rows.map((role) => {
    const target = defaults[role.name]

    if (!target) return { role, action: 'skip-unknown' as const, reason: `"${role.name}" no es un rol del sistema` }
    if (Number(role.system) !== 1) return { role, action: 'skip-unknown' as const, reason: 'rol creado por el hotel' }

    const current = Array.isArray(role.permissions) ? role.permissions : []
    const targetHash = permissionsHash(target)

    if (sameSet(current, target)) {
      return role.defaultsHash === targetHash
        ? { role, action: 'up-to-date' as const, reason: 'ya es el default actual' }
        : { role, action: 'stamp' as const, reason: 'ya es el default actual, le falta la huella', nextPermissions: target, nextHash: targetHash }
    }

    if (!role.defaultsHash) {
      return {
        role,
        action: 'review' as const,
        reason: 'fila vieja sin huella: no se puede distinguir un default viejo de una personalización',
      }
    }

    if (role.defaultsHash === permissionsHash(current)) {
      return {
        role,
        action: 'update' as const,
        reason: 'intacto desde el último sync',
        nextPermissions: target,
        nextHash: targetHash,
      }
    }

    return { role, action: 'skip-custom' as const, reason: 'personalizado: los permisos ya no coinciden con la huella' }
  })
}

/** Solo estas acciones escriben en la base. */
export const WRITES: ReadonlySet<SyncAction> = new Set<SyncAction>(['update', 'stamp'])
