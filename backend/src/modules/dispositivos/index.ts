// dispositivos/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerDispositivosModels } from './model'
import { DispositivosService } from './service'
import { DispositivosController } from './controller'
import type { DispositivosDTO } from './types'

export { DispositivosService }
export type { DispositivosDTO, CreateDispositivosDTO, UpdateDispositivosDTO, DispositivosQuery, DispositivosPaginated } from './types'
export type { DispositivosSockets } from './sockets'
export { DispositivosValidator, CreateDispositivosSchema, UpdateDispositivosSchema } from './validators/schema'

export function DispositivosModule() {
  return createModule({
    name: 'dispositivos',
    version: '1.0.0',
    description: 'Módulo de dispositivos',

    contract: {
      name: 'dispositivos',
      version: '1.0.0',
      description: 'Módulo de dispositivos',
      actions: ["list","getById","create","update","delete"],
      events: ["onDispositivosCreated","onDispositivosUpdated","onDispositivosDeleted"],
      tables: ['dispositivos'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerDispositivosModels(orm)

      const repo = new OrmRepository<DispositivosDTO>(orm, 'Devices')
      const log = logger.child('dispositivos')
      const service = new DispositivosService(repo, log, cache)
      const controller = new DispositivosController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/dispositivos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/dispositivos/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/dispositivos', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/dispositivos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/dispositivos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo dispositivos listo')
      return service
    },
  })
}
