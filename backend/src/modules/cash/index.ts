// cash/index.ts — PUERTA PÚBLICA del módulo Caja.
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerCashModels } from './model'
import { CashService } from './service'
import { CashController } from './controller'
import type { CashMovementDTO, CashShiftDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

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

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // Movimientos
      router.get('/api/caja/movements', guard('billing', 'view'), (req) => controller.index(req))
      router.get('/api/caja/movements/:id', guard('billing', 'view'), (req) => controller.show(req))
      router.post('/api/caja/movements', guard('billing', 'create'), (req) => controller.store(req))
      router.put('/api/caja/movements/:id', guard('billing', 'create'), (req) => controller.update(req))
      router.delete('/api/caja/movements/:id', guard('billing', 'create'), (req) => controller.destroy(req))
      // Turnos
      router.get('/api/caja/shifts', guard('billing', 'view'), (req) => controller.listShifts(req))
      router.get('/api/caja/shifts/current', guard('billing', 'view'), (req) => controller.currentShift(req))
      router.post('/api/caja/shifts/open', guard('billing', 'create'), (req) => controller.openShift(req))
      router.post('/api/caja/shifts/:id/close', guard('billing', 'create'), (req) => controller.closeShift(req))
      router.get('/api/caja/shifts/:id/reconcile', guard('billing', 'view'), (req) => controller.reconcile(req))
      // Stats
      router.get('/api/caja/stats', guard('billing', 'view'), (req) => controller.stats(req))

      log.info('Módulo caja listo')
      return service
    },
  })
}
