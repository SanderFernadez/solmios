// shared/tests/parse-role-permissions.test.ts — El validador de permisos de rol.
//
// Regresión histórica: los permisos se guardaban como `reservations.admin` (con punto) y `hasPermission`
// —que solo entiende `modulo:accion`— los ignoraba, dejando al usuario SIN acceso en silencio. Estos
// tests fijan que solo se persiste `modulo:accion` válido.

import { describe, it, expect } from 'bun:test'
import { parseRolePermissions } from '../usecases/parse-role-permissions'

describe('parseRolePermissions', () => {
  it('acepta permisos modulo:accion válidos', () => {
    expect(parseRolePermissions(['reservations:view', 'billing:edit'])).toEqual(['reservations:view', 'billing:edit'])
  })

  it('acepta el wildcard por módulo (modulo:*)', () => {
    expect(parseRolePermissions(['reservations:*'])).toEqual(['reservations:*'])
  })

  it('deduplica', () => {
    expect(parseRolePermissions(['rooms:view', 'rooms:view'])).toEqual(['rooms:view'])
  })

  it('acepta un array vacío', () => {
    expect(parseRolePermissions([])).toEqual([])
  })

  it('rechaza el formato viejo con punto (reservations.view)', () => {
    expect(() => parseRolePermissions(['reservations.view'])).toThrow(/inválido|Permiso/i)
  })

  it('rechaza un módulo desconocido', () => {
    expect(() => parseRolePermissions(['inexistente:view'])).toThrow(/desconocido/i)
  })

  it('rechaza una acción desconocida', () => {
    expect(() => parseRolePermissions(['reservations:teletransportar'])).toThrow(/desconocido/i)
  })

  it('rechaza *:* — el acceso total es solo de super_admin', () => {
    expect(() => parseRolePermissions(['*:*'])).toThrow()
  })

  it('rechaza si no es un array', () => {
    expect(() => parseRolePermissions('reservations:view')).toThrow(/array/i)
    expect(() => parseRolePermissions(null)).toThrow(/array/i)
  })

  it('rechaza elementos no-string', () => {
    expect(() => parseRolePermissions([{ module: 'rooms', actions: ['view'] }])).toThrow()
  })
})
