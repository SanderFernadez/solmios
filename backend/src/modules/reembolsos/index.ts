// reembolsos/index.ts — PUERTA PÚBLICA
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerReembolsosModels } from './model'
import { ReembolsosService } from './service'
import { ReembolsosController } from './controller'
import type { ExpenseClaimDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { ReembolsosService }
export type {
  ExpenseClaimDTO, CreateExpenseClaimDTO, UpdateExpenseClaimDTO, ClaimTotals,
  ReembolsosDTO, CreateReembolsosDTO, UpdateReembolsosDTO, ReembolsosQuery, ReembolsosPaginated,
} from './types'
export type { ReembolsosSockets } from './sockets'
export { ReembolsosValidator, CreateReembolsosSchema, UpdateReembolsosSchema } from './validators/schema'

export function ReembolsosModule() {
  return createModule({
    name: 'reembolsos',
    version: '1.0.0',
    description: 'Reembolsos de gastos del empleado (Odoo hr_expense)',

    contract: {
      name: 'reembolsos',
      version: '1.0.0',
      description: 'Reembolsos: submit → aprobar → pagar',
      actions: ['list', 'totals', 'getById', 'create', 'update', 'submit', 'approve', 'reject', 'pay', 'delete'],
      events: ['onClaimSubmitted', 'onClaimApproved', 'onClaimPaid'],
      tables: ['expense_claims'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('reembolsos: auth dependency required')
      registerReembolsosModels(orm)

      const repo = new OrmRepository<ExpenseClaimDTO>(orm, 'ExpenseClaim')
      const log = logger.child('reembolsos')
      const service = new ReembolsosService(repo, log, cache, auth)
      const controller = new ReembolsosController(service, log)

      // Reembolsos = dinero de RRHH → permiso `billing` (mismo criterio financiero que folios/pagos).
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('hr.reembolsos')]

      router.get('/api/expense-claims', guard('billing', 'view'), (req) => controller.index(req))
      router.get('/api/expense-claims/totals', guard('billing', 'view'), (req) => controller.totals(req))
      router.get('/api/expense-claims/:id', guard('billing', 'view'), (req) => controller.show(req))
      router.post('/api/expense-claims', guard('billing', 'create'), (req) => controller.store(req))
      router.put('/api/expense-claims/:id', guard('billing', 'edit'), (req) => controller.update(req))
      router.post('/api/expense-claims/:id/submit', guard('billing', 'edit'), (req) => controller.submit(req))
      router.post('/api/expense-claims/:id/approve', guard('billing', 'edit'), (req) => controller.approve(req))
      router.post('/api/expense-claims/:id/reject', guard('billing', 'edit'), (req) => controller.reject(req))
      router.post('/api/expense-claims/:id/pay', guard('billing', 'create'), (req) => controller.pay(req))
      router.delete('/api/expense-claims/:id', guard('billing', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo reembolsos listo — flujo submit/aprobar/pagar')
      return service
    },
  })
}
