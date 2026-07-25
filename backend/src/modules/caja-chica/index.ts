// caja-chica/index.ts — PUERTA PÚBLICA del módulo de caja chica. ⚠ Append-only.
// Caja chica = fondo fijo con custodio para gastos menores. NO es turnos POS (módulo `cash`).
// v1: gestión del fondo + saldo persistido + vínculo con gastos + reposición manual. Sin dinero real.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerCajaChicaModels } from './model'
import { CajaChicaService } from './service'
import { CajaChicaController } from './controller'
import type { PettyCashFundDTO, PettyCashReplenishmentDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { CajaChicaService }
export type {
  PettyCashFundDTO, CreatePettyCashFundDTO, UpdatePettyCashFundDTO,
  PettyCashReplenishmentDTO, CreatePettyCashReplenishmentDTO,
} from './types'
export type { CajaChicaSockets } from './sockets'
export { registerCajaChicaModels } from './model'
export { CajaChicaValidator, CreateFundSchema, UpdateFundSchema, CreateReplenishmentSchema } from './validators/schema'

export function CajaChicaModule() {
  return createModule({
    name: 'caja-chica',
    version: '1.0.0',
    description: 'Caja chica: fondos fijos con custodio para gastos menores y su reposición',
    contract: {
      name: 'caja-chica', version: '1.0.0',
      description: 'Caja chica del hotel',
      actions: [
        'listFunds', 'getFund', 'createFund', 'updateFund', 'deleteFund',
        'listReplenishments', 'requestReplenishment', 'completeReplenishment',
        'applyExpenseOutflow', 'revertExpenseOutflow',
      ],
      events: ['onFundCreated', 'onFundUpdated', 'onFundDeleted'],
      tables: ['petty_cash_funds', 'petty_cash_replenishments'],
      dependencies: [],
      rules: [
        'No importar de otros módulos',
        'currentBalance se mueve solo vía conector caja-chica-gastos o reposición completed',
        'Reusa permiso treasury (submódulo treasury.petty-cash), NO crea permiso nuevo',
      ],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('caja-chica: auth dependency required')
      registerCajaChicaModels(orm)

      const funds = new OrmRepository<PettyCashFundDTO>(orm, 'PettyCashFunds')
      const replenishments = new OrmRepository<PettyCashReplenishmentDTO>(orm, 'PettyCashReplenishments')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('caja-chica')
      const service = new CajaChicaService(funds, replenishments, userRepo, auth, log)
      const controller = new CajaChicaController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      // v1 reusa el permiso de treasury (submódulo treasury.petty-cash) — NO crea permiso nuevo.
      // El guard de módulo también gatea por `treasury` (el submódulo vive bajo ese módulo top-level).
      const guard = (a: string) => [...permGuard('treasury', a), moduleGuard('treasury')]

      // Fondos
      router.get('/api/petty-cash/funds', guard('view'), (req) => controller.indexFunds(req))
      router.get('/api/petty-cash/funds/:id', guard('view'), (req) => controller.showFund(req))
      router.post('/api/petty-cash/funds', guard('create'), (req) => controller.storeFund(req))
      router.put('/api/petty-cash/funds/:id', guard('edit'), (req) => controller.updateFund(req))
      router.delete('/api/petty-cash/funds/:id', guard('delete'), (req) => controller.destroyFund(req))

      // Reposiciones
      router.get('/api/petty-cash/funds/:id/replenishments', guard('view'), (req) => controller.indexReplenishments(req))
      router.post('/api/petty-cash/replenishments', guard('create'), (req) => controller.storeReplenishment(req))
      router.post('/api/petty-cash/replenishments/:id/complete', guard('edit'), (req) => controller.completeReplenishment(req))

      log.info('Módulo caja-chica listo')
      return service
    },
  })
}
