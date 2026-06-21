// paquetes/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerPaquetesModels } from './model'
import { PaquetesService } from './service'
import { PaquetesController } from './controller'
import type { PaquetesDTO } from './types'

export { PaquetesService }
export type { PaquetesDTO, CreatePaquetesDTO, UpdatePaquetesDTO, PaquetesQuery, PaquetesPaginated } from './types'
export type { PaquetesSockets } from './sockets'
export { PaquetesValidator, CreatePaquetesSchema, UpdatePaquetesSchema } from './validators/schema'

export function PaquetesModule() {
  return createModule({
    name: 'paquetes',
    version: '1.0.0',
    description: 'Módulo de paquetes',

    contract: {
      name: 'paquetes',
      version: '1.0.0',
      description: 'Módulo de paquetes',
      actions: ["list","getById","create","update","delete"],
      events: ["onPaquetesCreated","onPaquetesUpdated","onPaquetesDeleted"],
      tables: ['paquetes'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerPaquetesModels(orm)

      const repo = new OrmRepository<PaquetesDTO>(orm, 'Packages')
      const log = logger.child('paquetes')
      const service = new PaquetesService(repo, log, cache)
      const controller = new PaquetesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/paquetes', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/paquetes/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/paquetes', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/paquetes/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/paquetes/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo paquetes listo')
      return service
    },
  })
}
