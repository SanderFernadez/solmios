// shared/tests/payroll-permissions.test.ts — Nómina se protege con payroll:*, no billing:*.
//
// GitLab #152/#153: los 16 endpoints de nómina usaban guard('billing', ...). receptionist tiene
// billing:view/create → podía VER y CREAR liquidaciones de sueldo. Y payroll no estaba en MODULES,
// así que hasPermission('payroll', ...) nunca lo reconocía. Se agregó el módulo payroll y el permiso
// payroll:* SÓLO a hotel_admin.

import { describe, it, expect } from 'bun:test'
import { DEFAULT_ROLE_PERMISSIONS, hasPermission, MODULES } from '../permissions'

describe('permiso payroll:*', () => {
  it('payroll está declarado en MODULES (#153)', () => {
    expect(Object.keys(MODULES)).toContain('payroll')
  })

  it('hotel_admin puede operar toda la nómina', () => {
    const admin = DEFAULT_ROLE_PERMISSIONS.hotel_admin
    for (const action of ['view', 'create', 'edit', 'delete']) {
      expect(hasPermission(admin, 'payroll', action)).toBe(true)
    }
  })

  it('receptionist NO tiene ningún acceso a nómina (#152)', () => {
    const recep = DEFAULT_ROLE_PERMISSIONS.receptionist
    for (const action of ['view', 'create', 'edit', 'delete']) {
      expect(hasPermission(recep, 'payroll', action)).toBe(false)
    }
  })

  it('tener billing:* ya NO abre la nómina', () => {
    // Exactamente el bypass que reportaba #152: billing y payroll son módulos distintos.
    const soloBilling = ['billing:view', 'billing:create', 'billing:edit', 'billing:delete']
    expect(hasPermission(soloBilling, 'payroll', 'view')).toBe(false)
    expect(hasPermission(soloBilling, 'payroll', 'create')).toBe(false)
  })

  it('ningún otro rol de sistema accede a nómina', () => {
    for (const role of ['housekeeper', 'supervisor', 'maintenance', 'waiter', 'kitchen']) {
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS[role], 'payroll', 'view')).toBe(false)
    }
  })
})
