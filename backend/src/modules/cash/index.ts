// cash/index.ts — PUERTA PÚBLICA del módulo Caja.
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerCashModels } from './model'
import { CashService } from './service'
import { CashController } from './controller'
import type { CashMovementDTO, CashShiftDTO } from './types'

export { CashService }
export type {
  CashMovementDTO, CashShiftDTO, CreateMovementDTO, UpdateMovementDTO,
  MovementQuery, CashPaginated, OpenShiftDTO, CloseShiftDTO,
  ReconcileResult, CashStats, MovementType,
} from './types'
export type { CashSockets } from './sockets'
export { CashValidator, CreateMovementSchema, UpdateMovementSchema, OpenShiftSchema, CloseShiftSchema } from './validators/schema'

export function CashModule() {
  return createModule({
    name: 'caja',
    version: '1.0.0',
    description: 'Caja: movimientos y turnos con arqueo',

    contract: {
      name: 'caja',
      version: '1.0.0',
      description: 'Caja: movimientos y turnos con arqueo',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'listShifts', 'getCurrentShift', 'openShift', 'closeShift', 'reconcile', 'stats', 'registerPaymentIncome'],
      events: ['onCashMovementCreated', 'onCashMovementUpdated', 'onCashMovementDeleted', 'onShiftOpened', 'onShiftClosed'],
      tables: ['cash_movements', 'cash_shifts'],
      dependencies: [],
      rules: ['hotelId forzado del JWT en create (P0 IDOR)', 'registerPaymentIncome con dedup por paymentId'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('caja: auth dependency required')
      registerCashModels(orm)

      const repo = new OrmRepository<CashMovementDTO>(orm, 'CashMovements')
      const shiftRepo = new OrmRepository<CashShiftDTO>(orm, 'CashShifts')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('caja')
      const service = new CashService(repo, shiftRepo, userRepo, log, cache, auth!)
      const controller = new CashController(service, log)

      const READ = ['hotel_admin', 'receptionist', 'super_admin']
      const WRITE = ['hotel_admin', 'super_admin']

      // Movimientos
      router.get('/api/caja/movements', [auth.authenticate(...READ)], (req) => controller.index(req))
      router.get('/api/caja/movements/:id', [auth.authenticate(...READ)], (req) => controller.show(req))
      router.post('/api/caja/movements', [auth.authenticate(...WRITE)], (req) => controller.store(req))
      router.put('/api/caja/movements/:id', [auth.authenticate(...WRITE)], (req) => controller.update(req))
      router.delete('/api/caja/movements/:id', [auth.authenticate(...WRITE)], (req) => controller.destroy(req))
      // Turnos
      router.get('/api/caja/shifts', [auth.authenticate(...READ)], (req) => controller.listShifts(req))
      router.get('/api/caja/shifts/current', [auth.authenticate(...READ)], (req) => controller.currentShift(req))
      router.post('/api/caja/shifts/open', [auth.authenticate(...WRITE)], (req) => controller.openShift(req))
      router.post('/api/caja/shifts/:id/close', [auth.authenticate(...WRITE)], (req) => controller.closeShift(req))
      router.get('/api/caja/shifts/:id/reconcile', [auth.authenticate(...READ)], (req) => controller.reconcile(req))
      // Stats
      router.get('/api/caja/stats', [auth.authenticate(...READ)], (req) => controller.stats(req))

      log.info('Módulo caja listo')
      return service
    },
  })
}
