import { createModule, OrmRepository } from 'arckode-framework'
import type { LockDeviceDTO, LockCodeDTO } from './types'
import { TtlockService } from './service'
import { TtlockController } from './controller'

export { TtlockService }

export function TtlockModule() {
  return createModule({
    name: 'ttlock',
    version: '1.0.0',
    description: 'TTLock integration: config, sync, codes',
    contract: {
      name: 'ttlock', version: '1.0.0',
      description: 'TTLock smart lock management',
      actions: ['getConfig', 'updateConfig', 'connect', 'listLocks', 'syncLocks', 'generateCode', 'revokeCode', 'updateLock'],
      events: [],
      tables: ['lock_devices', 'lock_codes'],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('ttlock: auth dependency required')
      const log = logger.child('ttlock')
      const lockDevicesRepo = new OrmRepository<LockDeviceDTO>(orm, 'LockDevices')
      const lockCodesRepo = new OrmRepository<LockCodeDTO>(orm, 'LockCodes')
      const service = new TtlockService(lockDevicesRepo, lockCodesRepo, orm, log, auth)
      const controller = new TtlockController(service, log)

      const hsa = [auth.authenticate('hotel_admin', 'super_admin')]
      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/ttlock/config', hsa, (req: any) => controller.getConfig(req))
      router.put('/api/ttlock/config', hsa, (req: any) => controller.updateConfig(req))
      router.post('/api/ttlock/connect', hsa, (req: any) => controller.connect(req))
      router.get('/api/ttlock/locks', hra, (req: any) => controller.listLocks(req))
      router.post('/api/ttlock/sync', hsa, (req: any) => controller.syncLocks(req))
      router.post('/api/ttlock/generate-code/:reservationId', hsa, (req: any) => controller.generateCode(req))
      router.delete('/api/ttlock/code/:id', hsa, (req: any) => controller.revokeCode(req))
      router.put('/api/ttlock/lock/:id', hsa, (req: any) => controller.updateLock(req))

      log.info('Módulo ttlock listo (8 endpoints)')
      return service
    },
  })
}
