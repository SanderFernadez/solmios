import { createModule, OrmRepository } from 'arckode-framework'
import { bodyLimit } from 'arckode-framework/middlewares'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerHousekeepingModels } from './model'
import { HousekeepingService } from './service'
import { HousekeepingController } from './controller'
import type { HousekeepingDTO } from './types'

// Límite del body de upload por foto (10 MB). Las fotos viajan como base64 en JSON,
// que infla ~33% respecto al binario → 10 MB cubre fotos reales de hasta ~7 MB.
const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024
const PHOTO_UPLOAD_LIMIT = 10 * BYTES_PER_MB

export { HousekeepingService }
export type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated, StaffStats, StaffStatsQuery, PhotoEvidence } from './types'
export type { HousekeepingSockets } from './sockets'
export { HousekeepingValidator, CreateHousekeepingSchema, UpdateHousekeepingSchema } from './validators/schema'

export function HousekeepingModule(opts: { storage?: StorageService } = {}) {
  return createModule({
    name: 'housekeeping',
    version: '2.1.0',
    description: 'Módulo de housekeeping — limpieza y mantenimiento de habitaciones con tiempos, fotos y estadísticas',
    contract: {
      name: 'housekeeping',
      version: '2.1.0',
      description: 'Housekeeping tasks with ownership, timings, photo evidence and staff stats',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'start', 'complete', 'uploadPhoto', 'removePhoto', 'stats'],
      events: ['onHousekeepingCreated', 'onHousekeepingUpdated', 'onHousekeepingDeleted'],
      tables: ['housekeeping'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable', 'State machine enforced in service'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('housekeeping: auth dependency required')
      registerHousekeepingModels(orm)
      const repo = new OrmRepository<HousekeepingDTO>(orm, 'Housekeeping')
      const log = logger.child('housekeeping')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const employeeRepo = new OrmRepository<any>(orm, 'EmployeeProfile')
      const service = new HousekeepingService(repo, log, cache, userRepo, auth, employeeRepo, opts.storage)
      const controller = new HousekeepingController(service, log)

      router.get('/api/housekeeping', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      // /stats ANTES que /:id: el router enruta por orden de registro y /:id capturaría "stats".
      router.get('/api/housekeeping/stats', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.stats(req))
      router.get('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/housekeeping', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.put('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      // Endpoints de administración (F3). FUTURE: cuando exista la app móvil del staff,
      // agregar 'staff' a los auth.authenticate(...) de start/complete/photos.
      router.put('/api/housekeeping/:id/start', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.start(req))
      router.put('/api/housekeeping/:id/complete', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.complete(req))
      router.post('/api/housekeeping/:id/photos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin'), bodyLimit(PHOTO_UPLOAD_LIMIT)], (req) => controller.uploadPhoto(req))
      router.delete('/api/housekeeping/:id/photos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.removePhoto(req))

      log.info('Módulo housekeeping v2.1 listo (timings + fotos + stats)')
      return service
    },
  })
}
