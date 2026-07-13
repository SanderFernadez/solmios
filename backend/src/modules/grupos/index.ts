// grupos/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerGruposModels } from './model'
import { GruposService } from './service'
import { GruposController } from './controller'
import type { GruposDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { GruposService }
export type { GruposDTO, CreateGruposDTO, UpdateGruposDTO, GruposQuery, GruposPaginated } from './types'
export type { GruposSockets } from './sockets'
export { GruposValidator, CreateGruposSchema, UpdateGruposSchema } from './validators/schema'

export function GruposModule() {
  return createModule({
    name: 'grupos',
    version: '1.0.0',
    description: 'Módulo de grupos',

    contract: {
      name: 'grupos',
      version: '1.0.0',
      description: 'Módulo de grupos',
      actions: ["list","getById","create","update","delete"],
      events: ["onGruposCreated","onGruposUpdated","onGruposDeleted"],
      tables: ['grupos'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('grupos: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerGruposModels(orm)

      const repo = new OrmRepository<GruposDTO>(orm, 'Groups')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('grupos')
      const service = new GruposService(repo, userRepo, log, cache, auth)
      const controller = new GruposController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/grupos', guard('reservations', 'view'), (req) => controller.index(req))
      router.get('/api/grupos/:id', guard('reservations', 'view'), (req) => controller.show(req))
      router.post('/api/grupos', guard('reservations', 'create'), (req) => controller.store(req))
      // SC-03: el PUT (actualizar) exigía `reservations:create` en vez de `reservations:edit`.
      router.put('/api/grupos/:id', guard('reservations', 'edit'), (req) => controller.update(req))
      router.delete('/api/grupos/:id', guard('reservations', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo grupos listo')
      return service
    },
  })
}
