import { createModule, OrmRepository } from 'arckode-framework'
import type { LockDeviceDTO, LockCodeDTO } from './types'
import { registerTtlockModels } from './model'
import { TtlockService } from './service'
import { TtlockController } from './controller'
import { TtlockQueries } from './usecases/ttlock-queries'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { TtlockService }

export function TtlockModule() {
  return createModule({
    name: 'ttlock',
    version: '1.0.0',
    description: 'TTLock integration: config, sync, codes',
    contract: {
      name: 'ttlock', version: '1.0.0',
      description: 'TTLock smart lock management',
      actions: ['getConfig', 'updateConfig', 'connect', 'listLocks', 'listCodes', 'listGateways', 'listActiveCodes', 'listRecords', 'syncLocks', 'generateCode', 'revokeCode', 'updateLock'],
      events: [],
      tables: ['lock_devices', 'lock_codes'],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('ttlock: auth dependency required')
      // ttlock es el dueño canónico de LockDevices/LockCodes (ya no viven en shared/models). Sin
      // este registro, `orm.findMany('LockCodes', ...)` — que hace el detalle de una reserva — falla
      // con "Modelo 'LockCodes' no definido" al abrir cualquier reserva desde Planning.
      registerTtlockModels(orm)
      const log = logger.child('ttlock')
      const lockDevicesRepo = new OrmRepository<LockDeviceDTO>(orm, 'LockDevices')
      const lockCodesRepo = new OrmRepository<LockCodeDTO>(orm, 'LockCodes')
      const queries = new TtlockQueries(orm)
      const service = new TtlockService(lockDevicesRepo, lockCodesRepo, log, queries, auth)
      const controller = new TtlockController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/ttlock/config', guard('ttlock', 'view'), (req: any) => controller.getConfig(req))
      router.put('/api/ttlock/config', guard('ttlock', 'edit'), (req: any) => controller.updateConfig(req))
      router.post('/api/ttlock/connect', guard('ttlock', 'edit'), (req: any) => controller.connect(req))
      router.get('/api/ttlock/locks', guard('ttlock', 'view'), (req: any) => controller.listLocks(req))
      router.get('/api/ttlock/codes', guard('ttlock', 'view'), (req: any) => controller.listCodes(req))
      router.get('/api/ttlock/gateways', guard('ttlock', 'view'), (req: any) => controller.listGateways(req))
      router.get('/api/ttlock/locks/:id/active-codes', guard('ttlock', 'view'), (req: any) => controller.listActiveCodes(req))
      router.get('/api/ttlock/locks/:id/records', guard('ttlock', 'view'), (req: any) => controller.listRecords(req))
      router.post('/api/ttlock/sync', guard('ttlock', 'edit'), (req: any) => controller.syncLocks(req))
      router.post('/api/ttlock/generate-code/:reservationId', guard('ttlock', 'edit'), (req: any) => controller.generateCode(req))
      router.delete('/api/ttlock/code/:id', guard('ttlock', 'edit'), (req: any) => controller.revokeCode(req))
      router.put('/api/ttlock/lock/:id', guard('ttlock', 'edit'), (req: any) => controller.updateLock(req))

      log.info('Módulo ttlock listo (11 endpoints)')
      return service
    },
  })
}
