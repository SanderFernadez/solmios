// shared/tests/permissions.test.ts — Resolución de permisos por rol.
//
// Regresión 1: `hotel_admin` no tenía los `:delete` de billing/housekeeping/maintenance ni los
// create/edit/delete de dashboard/reports/settings. 32 endpoints eran inalcanzables para el dueño.
//
// Regresión 2: la tabla `roles` de instalaciones viejas guarda `billing.read` (con PUNTO). Como
// `getRolePermissions` devolvía los permisos de la DB tal cual, y `hasPermission` solo entiende dos
// puntos, ese rol quedaba sin acceso a NADA, en silencio.

import { describe, it, expect } from 'bun:test'
import { getRolePermissions, hasPermission, DEFAULT_ROLE_PERMISSIONS } from '../permissions'

describe('hotel_admin administra todo su hotel', () => {
  const perms = DEFAULT_ROLE_PERMISSIONS.hotel_admin

  it('puede borrar lo que factura y gasta', () => {
    expect(hasPermission(perms, 'billing', 'delete')).toBe(true)
  })

  it('puede administrar housekeeping y mantenimiento por completo', () => {
    expect(hasPermission(perms, 'housekeeping', 'delete')).toBe(true)
    expect(hasPermission(perms, 'maintenance', 'delete')).toBe(true)
  })

  it('puede administrar anuncios y notificaciones, no solo verlos', () => {
    expect(hasPermission(perms, 'dashboard', 'create')).toBe(true)
    expect(hasPermission(perms, 'dashboard', 'delete')).toBe(true)
  })

  it('puede administrar tickets, opiniones y el night audit', () => {
    expect(hasPermission(perms, 'reports', 'create')).toBe(true)
    expect(hasPermission(perms, 'reports', 'edit')).toBe(true)
  })

  it('puede administrar dispositivos, api keys y bloqueos de tarifa', () => {
    expect(hasPermission(perms, 'settings', 'create')).toBe(true)
    expect(hasPermission(perms, 'settings', 'delete')).toBe(true)
  })

  // Alta/baja de hoteles es de plataforma: `hotels:*` no lo tiene ningún rol de hotel.
  it('NO puede crear ni borrar hoteles', () => {
    expect(hasPermission(perms, 'hotels', 'create')).toBe(false)
    expect(hasPermission(perms, 'hotels', 'delete')).toBe(false)
  })

  it('ningún otro rol de hotel puede crear hoteles', () => {
    for (const role of ['receptionist', 'housekeeper', 'maintenance', 'supervisor']) {
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS[role] ?? [], 'hotels', 'create')).toBe(false)
    }
  })
})

describe('getRolePermissions — permisos de la DB', () => {
  it('usa los de la DB cuando están en formato `modulo:accion`', () => {
    expect(getRolePermissions('receptionist', ['billing:view', 'rooms:*'])).toEqual(['billing:view', 'rooms:*'])
  })

  // La bomba: sin este filtro, el usuario quedaba bloqueado de todo el sistema.
  it('ignora el formato viejo con punto y cae a los defaults', () => {
    const result = getRolePermissions('hotel_admin', ['billing.read', 'billing.admin'] as any)
    expect(result).toEqual(DEFAULT_ROLE_PERMISSIONS.hotel_admin)
    expect(hasPermission(result, 'billing', 'view')).toBe(true)
  })

  it('descarta las entradas inválidas y conserva las válidas', () => {
    expect(getRolePermissions('receptionist', ['billing.read', 'rooms:view'] as any)).toEqual(['rooms:view'])
  })

  it('una lista vacía o basura cae a los defaults', () => {
    expect(getRolePermissions('receptionist', [])).toEqual(DEFAULT_ROLE_PERMISSIONS.receptionist)
    expect(getRolePermissions('receptionist', [null, 42] as any)).toEqual(DEFAULT_ROLE_PERMISSIONS.receptionist)
  })

  it('un rol desconocido no tiene permisos', () => {
    expect(getRolePermissions('inexistente')).toEqual([])
  })
})

describe('hasPermission', () => {
  it('acepta el wildcard de módulo', () => {
    expect(hasPermission(['billing:*'], 'billing', 'delete')).toBe(true)
  })

  it('acepta el wildcard total que loadPermissions le da a super_admin', () => {
    expect(hasPermission(['*:*'], 'lo-que-sea', 'delete')).toBe(true)
  })

  it('no confunde módulos distintos', () => {
    expect(hasPermission(['billing:*'], 'reports', 'view')).toBe(false)
  })

  it('tolera una lista ausente', () => {
    expect(hasPermission(undefined as any, 'billing', 'view')).toBe(false)
  })
})
