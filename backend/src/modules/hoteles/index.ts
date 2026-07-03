// hoteles/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerHotelesModels } from './model'
import { HotelesService } from './service'
import { HotelesController } from './controller'
import { SettingsFullUseCase } from './usecases/settings-full'
import type { HotelesDTO } from './types'

export { HotelesService }
export { SettingsFullUseCase }
export type { HotelesDTO, CreateHotelesDTO, UpdateHotelesDTO, HotelesQuery, HotelesPaginated } from './types'
export type { HotelesSockets } from './sockets'
export { HotelesValidator, CreateHotelesSchema, UpdateHotelesSchema } from './validators/schema'

export function HotelesModule() {
  return createModule({
    name: 'hoteles',
    version: '2.0.0',
    description: 'Módulo de hoteles — configuración, settings, multi-tenancy',

    contract: {
      name: 'hoteles',
      version: '2.0.0',
      description: 'Hotels settings with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onHotelesCreated', 'onHotelesUpdated', 'onHotelesDeleted'],
      tables: ['hotels'],
      dependencies: [],
      rules: ['Ownership check on read/write', 'Super_admin bypass', 'Pagination required'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('hoteles: auth dependency required')
      registerHotelesModels(orm)

      const repo = new OrmRepository<HotelesDTO>(orm, 'Hotels')
      const log = logger.child('hoteles')
      const settingsFull = new SettingsFullUseCase(orm)
      const service = new HotelesService(repo, log, cache, auth, orm, settingsFull)
      const controller = new HotelesController(service, log, orm)

      const hsa = [auth.authenticate('hotel_admin', 'super_admin')]
      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/hoteles', hra, (req) => controller.index(req))
      router.get('/api/hoteles/:id', hra, (req) => controller.show(req))
      router.post('/api/hoteles', [auth.authenticate('super_admin')], (req) => controller.store(req))
      router.put('/api/hoteles/:id', hsa, (req) => controller.update(req))
      router.delete('/api/hoteles/:id', [auth.authenticate('super_admin')], (req) => controller.destroy(req))

      // Settings
      router.get('/api/settings', hsa, (req) => controller.getSettings(req))
      router.put('/api/settings/hotel', hsa, (req) => controller.updateHotel(req))
      router.get('/api/settings/full', hsa, (req) => controller.getSettingsFull(req))
      router.get('/api/configuracion/:key', hra, (req) => controller.getConfig(req))
      router.post('/api/configuracion', hsa, (req) => controller.setConfig(req))

      log.info('Módulo hoteles v2 listo (5 settings endpoints)')
      return service
    },
  })
}
