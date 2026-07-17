// paquetes/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerPaquetesModels } from './model'
import { PaquetesService } from './service'
import { PaquetesController } from './controller'
import type { PaquetesDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

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
      if (!auth) throw new Error('paquetes: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerPaquetesModels(orm)

      const repo = new OrmRepository<PaquetesDTO>(orm, 'Packages')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('paquetes')
      const service = new PaquetesService(repo, userRepo, log, cache, auth)
      const controller = new PaquetesController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('sales.packages')]

      router.get('/api/paquetes', guard('rooms', 'view'), (req) => controller.index(req))
      router.get('/api/paquetes/:id', guard('rooms', 'view'), (req) => controller.show(req))
      router.post('/api/paquetes', guard('rooms', 'create'), (req) => controller.store(req))
      // SC-03: el PUT (actualizar) exigía `rooms:create` en vez de `rooms:edit`.
      router.put('/api/paquetes/:id', guard('rooms', 'edit'), (req) => controller.update(req))
      router.delete('/api/paquetes/:id', guard('rooms', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo paquetes listo')
      return service
    },
  })
}
