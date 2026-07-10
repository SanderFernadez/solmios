// ttlock/tests/module-registers-models.test.ts — ttlock debe registrar sus modelos al crearse.
//
// Regresión: al consolidar LockDevices/LockCodes en ttlock/model.ts (y sacarlos de shared/models),
// nadie llamaba registerTtlockModels(). El modelo 'LockCodes' quedaba sin definir, y abrir una reserva
// desde Planning (el detalle hace orm.findMany('LockCodes', ...)) reventaba con
// "Modelo 'LockCodes' no definido". Este test falla si el módulo deja de registrar sus modelos.

import { describe, it, expect } from 'bun:test'
import { TtlockModule } from '../index'

describe('TtlockModule', () => {
  it('registra LockCodes y LockDevices en el ORM al crearse', () => {
    const defined: string[] = []
    const orm = { define: (name: string) => { defined.push(name) } } as any
    const noop = () => {}
    const router = { get: noop, post: noop, put: noop, delete: noop } as any
    const logger = { child: () => ({ info: noop, warn: noop, error: noop, debug: noop }) } as any
    // guard() llama auth.authenticate(...roles); devolvemos un middleware vacío.
    const auth = { authenticate: () => noop } as any
    const cache = {} as any

    const mod = TtlockModule() as any
    mod.create({ logger, orm, cache, router, auth })

    expect(defined).toContain('LockCodes')
    expect(defined).toContain('LockDevices')
  })
})
