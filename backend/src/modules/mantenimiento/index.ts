import { createModule, OrmRepository } from 'arckode-framework'
import { bodyLimit } from 'arckode-framework/middlewares'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerMantenimientoModels } from './model'
import { MantenimientoService } from './service'
import { MantenimientoController } from './controller'
import type { MantenimientoDTO, MaintenanceAuditDTO, MaintenanceProviderDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

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
      // Catálogo de servicios externos (plomero, electricista…). Vive en este
      // módulo para que el ticket pueda referenciarlo sin necesitar un connector.
      const providerRepo = new OrmRepository<MaintenanceProviderDTO>(orm, 'MaintenanceProvider')
      const service = new MantenimientoService(repo, log, cache, userRepo, auth, auditRepo, opts?.storage, providerRepo)
      const controller = new MantenimientoController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/mantenimiento/stats', guard('maintenance', 'view'), (req) => controller.stats(req))

      // ─── Servicios externos (proveedores) ───────────────────────────────
      // ⚠️ ANTES de `/:id`: si van después, `:id` captura "proveedores" y estas
      // rutas nunca se alcanzan.
      router.get('/api/mantenimiento/proveedores', guard('maintenance', 'view'), (req) => controller.listProviders(req))
      router.post('/api/mantenimiento/proveedores', guard('maintenance', 'create'), (req) => controller.storeProvider(req))
      router.put('/api/mantenimiento/proveedores/:id', guard('maintenance', 'edit'), (req) => controller.updateProvider(req))
      router.delete('/api/mantenimiento/proveedores/:id', guard('maintenance', 'delete'), (req) => controller.destroyProvider(req))

      router.get('/api/mantenimiento', guard('maintenance', 'view'), (req) => controller.index(req))
      router.get('/api/mantenimiento/:id', guard('maintenance', 'view'), (req) => controller.show(req))
      router.post('/api/mantenimiento', guard('maintenance', 'create'), (req) => controller.store(req))
      router.put('/api/mantenimiento/:id', guard('maintenance', 'edit'), (req) => controller.update(req))
      router.delete('/api/mantenimiento/:id', guard('maintenance', 'delete'), (req) => controller.destroy(req))

      router.post('/api/mantenimiento/:id/start', guard('maintenance', 'edit'), (req) => controller.start(req))
      router.post('/api/mantenimiento/:id/complete', guard('maintenance', 'edit'), (req) => controller.complete(req))

      router.put('/api/mantenimiento/:id/notes', guard('maintenance', 'edit'), (req) => controller.addNotes(req))

      router.post('/api/mantenimiento/:id/photos', [...guard('maintenance', 'edit'), bodyLimit(PHOTO_UPLOAD_LIMIT)], (req) => controller.addPhoto(req))
      router.delete('/api/mantenimiento/:id/photos', guard('maintenance', 'edit'), (req) => controller.removePhoto(req))

      router.get('/api/mantenimiento/:id/audit', guard('maintenance', 'view'), (req) => controller.auditHistory(req))

      log.info('Modulo mantenimiento v1 listo — timer, audit, photos, stats')
      return service
    },
  })
}
