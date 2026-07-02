// folios/index.ts — PUERTA PÚBLICA del módulo de folios.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerFoliosModels } from './model'
import { FoliosService } from './service'
import { FoliosController } from './controller'
import type { FolioDTO, FolioChargeDTO, OpenFolioDTO } from './types'

export { FoliosService }
export type { FolioDTO, FolioChargeDTO, OpenFolioDTO, PostChargeDTO, ApplyPaymentDTO, FolioQuery, FolioListResult } from './types'
export type { FoliosSockets } from './sockets'
export { FoliosValidator } from './validators/schema'

export function FoliosModule() {
  return createModule({
    name: 'folios',
    version: '1.0.0',
    description: 'Folios acumulativos por reserva (cargos + pagos → factura)',
    contract: {
      name: 'folios', version: '1.0.0',
      description: 'Acumulador de cargos/pagos por reserva; al cerrarse genera factura',
      actions: ['list', 'getById', 'open', 'postCharge', 'applyPayment', 'close', 'summary'],
      events: ['onFolioOpened', 'onFolioCharged', 'onFolioPaid', 'onFolioClosed'],
      tables: ['folios', 'folio_charges'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Usar RepositoryAdapter<T>'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('folios: auth dependency required')
      registerFoliosModels(orm)
      const folioRepo = new OrmRepository<FolioDTO>(orm, 'Folios')
      const chargeRepo = new OrmRepository<FolioChargeDTO>(orm, 'FolioCharges')
      const configRepo = new OrmRepository<any>(orm, 'Configuration')
      const guestRepo = new OrmRepository<any>(orm, 'Guests')
      const reservationRepo = new OrmRepository<any>(orm, 'Reservations')
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('folios')
      const service = new FoliosService(
        folioRepo, chargeRepo, configRepo,
        { guest: guestRepo, reservation: reservationRepo, room: roomRepo, user: userRepo },
        log, cache, auth!,
      )
      const controller = new FoliosController(service, log)

      router.get('/api/folios', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/folios/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/folios', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.post('/api/folios/:id/charges', [auth.authenticate('hotel_admin', 'receptionist')], (req) => controller.charge(req))
      router.post('/api/folios/:id/payments', [auth.authenticate('hotel_admin', 'receptionist')], (req) => controller.payment(req))
      router.post('/api/folios/:id/close', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.close(req))
      // /api/folios/:id/invoice se registra en composition-root (crea factura real cross-module) — sin ruta duplicada (V-07)

      log.info('Módulo folios listo')
      return service
    },
  })
}
