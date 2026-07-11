// shared/usecases/parse-role-permissions.ts — Normaliza y valida los permisos de un rol.
//
// El sistema entiende UN solo formato: `modulo:accion` (ver hasPermission en shared/permissions.ts).
// Instalaciones viejas guardaban `reservations.admin` (con punto): `hasPermission` no lo entiende, así
// que un rol con ese formato dejaba al usuario SIN acceso a nada, en silencio. Este parser rechaza todo
// lo que no sea `modulo:accion` válido (módulo ∈ MODULES, acción ∈ ACTIONS o `*`), así no se persiste
// basura que después bloquee al empleado.
//
// `validateSchema` no soporta arrays, por eso los permisos se validan acá y no en el schema (mem 1805).

import { ValidationError } from 'arckode-framework'
import { MODULES, ACTIONS, type Permission } from '../permissions'

const VALID_MODULES = new Set(Object.keys(MODULES))
const VALID_ACTIONS = new Set<string>([...Object.keys(ACTIONS), '*'])

/**
 * Valida un array de permisos `modulo:accion`. Deduplica. Lanza en el primer inválido.
 * NO acepta `*:*` (acceso total es solo de super_admin, no algo que un hotel se auto-otorgue).
 */
export function parseRolePermissions(raw: unknown): Permission[] {
  if (!Array.isArray(raw)) {
    throw new ValidationError('permissions debe ser un array de "modulo:accion"')
  }
  const out = new Set<Permission>()
  for (const p of raw) {
    if (typeof p !== 'string' || !p.includes(':')) {
      throw new ValidationError(`Permiso inválido (se espera "modulo:accion"): ${JSON.stringify(p)}`)
    }
    const [mod, action] = p.split(':')
    if (mod === '*' || !VALID_MODULES.has(mod) || !VALID_ACTIONS.has(action)) {
      throw new ValidationError(`Permiso desconocido: ${p}`)
    }
    out.add(`${mod}:${action}`)
  }
  return [...out]
}
