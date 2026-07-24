// usuarios/tests/assignable-role.test.ts — Quién puede asignar qué rol al crear un usuario.
//
// Regresión #169: un rol personalizado se creaba pero NO se podía asignar (la lista de roles asignables
// era fija). Ahora un hotel_admin puede asignar los roles custom de su hotel, pero no un super_admin ni
// un rol de otro hotel.

import { describe, it, expect } from 'bun:test'
import { canAssignRole, systemRolesForCreator } from '../usecases/assignable-role'

describe('assignable-role', () => {
  it('hotel_admin asigna roles del sistema bajo su nivel', () => {
    expect(canAssignRole('hotel_admin', 'receptionist')).toBe(true)
    expect(canAssignRole('hotel_admin', 'housekeeper')).toBe(true)
  })

  it('hotel_admin NO puede asignar super_admin ni hotel_admin', () => {
    expect(canAssignRole('hotel_admin', 'super_admin')).toBe(false)
    expect(canAssignRole('hotel_admin', 'hotel_admin')).toBe(false)
  })

  it('hotel_admin asigna un rol PERSONALIZADO de su hotel', () => {
    expect(canAssignRole('hotel_admin', 'Cajero', ['Cajero', 'Gerente'])).toBe(true)
  })

  it('un rol custom que NO es del hotel no es asignable', () => {
    expect(canAssignRole('hotel_admin', 'CajeroDeOtroHotel', ['Cajero'])).toBe(false)
  })

  it('receptionist solo asigna limpieza/mantenimiento/mesero/cocina', () => {
    expect(canAssignRole('receptionist', 'housekeeper')).toBe(true)
    expect(canAssignRole('receptionist', 'waiter')).toBe(true)
    expect(canAssignRole('receptionist', 'kitchen')).toBe(true)
    expect(canAssignRole('receptionist', 'receptionist')).toBe(false)
  })

  it('hotel_admin asigna mesero/cocina (staff de restaurante)', () => {
    expect(canAssignRole('hotel_admin', 'waiter')).toBe(true)
    expect(canAssignRole('hotel_admin', 'kitchen')).toBe(true)
  })

  it('un rol desconocido (creador sin jerarquía) no asigna nada', () => {
    expect(systemRolesForCreator('inexistente')).toEqual([])
    expect(canAssignRole('inexistente', 'receptionist')).toBe(false)
  })
})
