import { createModule, OrmRepository } from 'arckode-framework'
import { bodyLimit } from 'arckode-framework/middlewares'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerHousekeepingModels } from './model'
import { HousekeepingService } from './service'
import { HousekeepingController } from './controller'
import type { HousekeepingDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

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
      actions: ['list', 'getById', 'create', 'update', 'delete', 'start', 'complete', 'uploadPhoto', 'removePhoto', 'stats', 'approve', 'reject', 'presence', 'report', 'photoRequirements', 'supplyLists'],
      events: ['onHousekeepingCreated', 'onHousekeepingUpdated', 'onHousekeepingDeleted'],
      tables: ['housekeeping', 'photo_requirements', 'supply_items'],
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
      const photoReqRepo = new OrmRepository<any>(orm, 'PhotoRequirement')
      const supplyRepo = new OrmRepository<any>(orm, 'SupplyItem')
      // La tarea guarda `roomId`; la app muestra "Hab. 201 · Piso 2". Sin este
      // repo la camarera veía tarjetas que decían "Hab." y "Piso 0".
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const service = new HousekeepingService(repo, log, cache, userRepo, auth, employeeRepo, opts.storage, photoReqRepo, supplyRepo, roomRepo)
      const controller = new HousekeepingController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/housekeeping', guard('housekeeping', 'view'), (req) => controller.index(req))
      router.get('/api/housekeeping/stats', guard('housekeeping', 'view'), (req) => controller.stats(req))
      router.get('/api/housekeeping/:id', guard('housekeeping', 'view'), (req) => controller.show(req))
      router.post('/api/housekeeping', guard('housekeeping', 'create'), (req) => controller.store(req))
      router.put('/api/housekeeping/:id', guard('housekeeping', 'edit'), (req) => controller.update(req))
      router.delete('/api/housekeeping/:id', guard('housekeeping', 'delete'), (req) => controller.destroy(req))

      router.put('/api/housekeeping/:id/start', guard('housekeeping', 'edit'), (req) => controller.start(req))
      router.put('/api/housekeeping/:id/complete', guard('housekeeping', 'edit'), (req) => controller.complete(req))
      router.post('/api/housekeeping/:id/photos', [...guard('housekeeping', 'edit'), bodyLimit(PHOTO_UPLOAD_LIMIT)], (req) => controller.uploadPhoto(req))
      router.delete('/api/housekeeping/:id/photos', guard('housekeeping', 'edit'), (req) => controller.removePhoto(req))

      // ─── Aprobación y presencia (F4/F5) ─────────────────────────────────
      router.post('/api/housekeeping/:id/approve', guard('housekeeping', 'edit'), (req) => controller.approve(req))
      router.post('/api/housekeeping/:id/reject', guard('housekeeping', 'edit'), (req) => controller.reject(req))
      router.post('/api/housekeeping/:id/presence', guard('housekeeping', 'edit'), (req) => controller.presence(req))
      router.post('/api/housekeeping/:id/report', guard('housekeeping', 'edit'), (req) => controller.report(req))

      // ─── Photo Requirements y Supply Lists ───────────────────────────────
      router.get('/api/housekeeping/photo-requirements', guard('housekeeping', 'view'), (req) => controller.photoRequirements(req))
      router.put('/api/housekeeping/photo-requirements', guard('housekeeping', 'edit'), (req) => controller.updatePhotoRequirements(req))
      router.get('/api/housekeeping/supply-lists', guard('housekeeping', 'view'), (req) => controller.supplyLists(req))
      router.put('/api/housekeeping/supply-lists', guard('housekeeping', 'edit'), (req) => controller.updateSupplyLists(req))

      log.info('Módulo housekeeping v2.1 listo (timings + fotos + stats)')
      return service
    },
  })
}
