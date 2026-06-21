// gastos/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerGastosModels } from './model'
import { GastosService } from './service'
import { GastosController } from './controller'
import type { GastosDTO } from './types'

export { GastosService }
export type { GastosDTO, CreateGastosDTO, UpdateGastosDTO, GastosQuery, GastosPaginated } from './types'
export type { GastosSockets } from './sockets'
export { GastosValidator, CreateGastosSchema, UpdateGastosSchema } from './validators/schema'

export function GastosModule() {
  return createModule({
    name: 'gastos',
    version: '1.0.0',
    description: 'Módulo de gastos',

    contract: {
      name: 'gastos',
      version: '1.0.0',
      description: 'Módulo de gastos',
      actions: ["list","getById","create","update","delete"],
      events: ["onGastosCreated","onGastosUpdated","onGastosDeleted"],
      tables: ['expenses'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('gastos: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerGastosModels(orm)

      const repo = new OrmRepository<GastosDTO>(orm, 'Expenses')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('gastos')
      const service = new GastosService(repo, userRepo, log, cache, auth!)
      const controller = new GastosController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/gastos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/gastos/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/gastos', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/gastos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/gastos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo gastos listo')
      return service
    },
  })
}
