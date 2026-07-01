import { createModule, OrmRepository } from 'arckode-framework'
import { bodyLimit } from 'arckode-framework/middlewares'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerMantenimientoModels } from './model'
import { MantenimientoService } from './service'
import { MantenimientoController } from './controller'
import type { MantenimientoDTO, MaintenanceAuditDTO } from './types'

export { MantenimientoService }
export type { MantenimientoDTO, CreateMantenimientoDTO, UpdateMantenimientoDTO, MantenimientoQuery, MantenimientoPaginated, MaintenanceAuditDTO, MaintenanceAuditAction } from './types'
export type { MantenimientoSockets } from './sockets'
export { MantenimientoValidator, CreateMantenimientoSchema, UpdateMantenimientoSchema } from './validators/schema'

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024
const PHOTO_UPLOAD_LIMIT = 10 * BYTES_PER_MB

export function MantenimientoModule(opts?: { storage?: StorageService }) {
  return createModule({
    name: 'mantenimiento',
    version: '1.0.0',
    description: 'Modulo de mantenimiento — tickets de reparacion con timer, audit y fotos',
    contract: {
      name: 'mantenimiento',
      version: '1.0.0',
      description: 'Maintenance tickets with timer, audit trail, photos, and notifications',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'start', 'complete', 'addNotes', 'addPhoto', 'removePhoto', 'getAuditHistory', 'getStats'],
      events: ['onMantenimientoCreated', 'onMantenimientoUpdated', 'onMantenimientoDeleted'],
      tables: ['maintenance', 'maintenance_audit'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable', 'Status transition validation', 'Audit trail on all changes'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('mantenimiento: auth dependency required')
      registerMantenimientoModels(orm)
      const repo = new OrmRepository<MantenimientoDTO>(orm, 'Maintenance')
      const auditRepo = new OrmRepository<MaintenanceAuditDTO>(orm, 'MaintenanceAudit')
      const log = logger.child('mantenimiento')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new MantenimientoService(repo, log, cache, userRepo, auth, auditRepo, opts?.storage)
      const controller = new MantenimientoController(service, log)

      // Stats ANTES que /:id: el router enruta por orden de registro y /:id capturaría "stats".
      router.get('/api/mantenimiento/stats', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.stats(req))

      // CRUD
      router.get('/api/mantenimiento', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/mantenimiento', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.put('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      // Timer
      router.post('/api/mantenimiento/:id/start', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.start(req))
      router.post('/api/mantenimiento/:id/complete', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.complete(req))

      // Notes
      router.put('/api/mantenimiento/:id/notes', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.addNotes(req))

      // Photos: upload (POST, bodyLimit 10MB) + remove (DELETE, ?url=...).
      router.post('/api/mantenimiento/:id/photos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin'), bodyLimit(PHOTO_UPLOAD_LIMIT)], (req) => controller.addPhoto(req))
      router.delete('/api/mantenimiento/:id/photos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.removePhoto(req))

      // Audit
      router.get('/api/mantenimiento/:id/audit', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.auditHistory(req))

      log.info('Modulo mantenimiento v1 listo — timer, audit, photos, stats')
      return service
    },
  })
}
