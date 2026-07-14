// roles/tests/assert-grantable.test.ts — S-A2: nadie otorga permisos que no tiene.

import { describe, it, expect } from 'bun:test'
import { assertGrantablePermissions } from '../usecases/assert-grantable'

describe('assertGrantablePermissions — S-A2', () => {
  it('super_admin (*:*) puede otorgar cualquier permiso', () => {
    expect(() => assertGrantablePermissions(['*:*'], ['billing:view', 'reports:export'])).not.toThrow()
  })

  it('un editor puede otorgar permisos que SÍ tiene', () => {
    expect(() => assertGrantablePermissions(['users:view', 'users:edit'], ['users:view'])).not.toThrow()
  })

  it('module:* cubre cualquier acción de ese módulo', () => {
    expect(() => assertGrantablePermissions(['billing:*'], ['billing:delete'])).not.toThrow()
  })

  it('BLOQUEA: un editor con solo users:edit intenta otorgar billing:view (la escalada)', () => {
    expect(() => assertGrantablePermissions(['users:view', 'users:edit'], ['billing:view']))
      .toThrow(/no tiene: billing:view/)
  })

  it('BLOQUEA: otorgar aunque sea UN permiso fuera del set del editor', () => {
    expect(() => assertGrantablePermissions(['dashboard:view'], ['dashboard:view', 'settings:edit']))
      .toThrow(/settings:edit/)
  })

  it('sin permisos del caller, no puede otorgar nada', () => {
    expect(() => assertGrantablePermissions(undefined, ['dashboard:view'])).toThrow()
    expect(() => assertGrantablePermissions([], ['dashboard:view'])).toThrow()
  })

  it('lista vacía de solicitados nunca falla', () => {
    expect(() => assertGrantablePermissions([], [])).not.toThrow()
  })
})
