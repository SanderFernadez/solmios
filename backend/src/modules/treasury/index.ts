// treasury/index.ts — PUERTA PÚBLICA del módulo de tesorería. ⚠ Append-only.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerTreasuryModels } from './model'
import { TreasuryService } from './service'
import { TreasuryController } from './controller'
import type { SupplierDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { TreasuryService }
export type { SupplierDTO, CreateSupplierDTO, UpdateSupplierDTO } from './types'
export { registerTreasuryModels } from './model'

export function TreasuryModule() {
  return createModule({
    name: 'treasury',
    version: '1.0.0',
    description: 'Tesorería: bancos, conciliación, flujo de caja, cuentas por cobrar/pagar y presupuesto',
    contract: {
      name: 'treasury', version: '1.0.0',
      description: 'Tesorería del hotel',
      actions: ['cashFlow', 'receivables', 'payables', 'listSuppliers', 'createSupplier', 'updateSupplier', 'deleteSupplier'],
      events: ['onSupplierCreated'],
      tables: ['bank_accounts', 'bank_movements', 'suppliers', 'budgets'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Los reportes leen payments/expenses/invoices read-only'],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('treasury: auth dependency required')
      registerTreasuryModels(orm)

      const suppliers = new OrmRepository<SupplierDTO>(orm, 'Suppliers')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      // ⚠ El modelo de pagos se registra en SINGULAR ('Payment'), no 'Payments' (igual que reports).
      // Con 'Payments' el ORM lanza "Modelo no definido" y cash-flow revienta en runtime.
      const payments = new OrmRepository<any>(orm, 'Payment')
      const expenses = new OrmRepository<any>(orm, 'Expenses')
      const invoices = new OrmRepository<any>(orm, 'Invoices')
      const bankAccounts = new OrmRepository<any>(orm, 'BankAccounts')
      const bankMovements = new OrmRepository<any>(orm, 'BankMovements')
      const budgets = new OrmRepository<any>(orm, 'Budgets')
      const log = logger.child('treasury')
      const service = new TreasuryService(suppliers, userRepo, auth, log, payments, expenses, invoices, bankAccounts, bankMovements, budgets)
      const controller = new TreasuryController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('treasury')]

      // Liquidez (TES-2/3/4)
      router.get('/api/treasury/cash-flow', guard('treasury', 'view'), (req) => controller.cashFlow(req))
      router.get('/api/treasury/receivables', guard('treasury', 'view'), (req) => controller.receivables(req))
      router.get('/api/treasury/payables', guard('treasury', 'view'), (req) => controller.payables(req))

      // Proveedores (TES-4)
      router.get('/api/treasury/suppliers', guard('treasury', 'view'), (req) => controller.indexSuppliers(req))
      router.post('/api/treasury/suppliers', guard('treasury', 'create'), (req) => controller.storeSupplier(req))
      router.put('/api/treasury/suppliers/:id', guard('treasury', 'edit'), (req) => controller.updateSupplier(req))
      router.delete('/api/treasury/suppliers/:id', guard('treasury', 'delete'), (req) => controller.destroySupplier(req))

      // Cuentas bancarias + conciliación (TES-1)
      router.get('/api/treasury/bank-accounts', guard('treasury', 'view'), (req) => controller.indexBankAccounts(req))
      router.post('/api/treasury/bank-accounts', guard('treasury', 'create'), (req) => controller.storeBankAccount(req))
      router.put('/api/treasury/bank-accounts/:id', guard('treasury', 'edit'), (req) => controller.updateBankAccount(req))
      router.post('/api/treasury/bank-accounts/:id/import', guard('treasury', 'edit'), (req) => controller.importMovements(req))
      router.post('/api/treasury/reconcile', guard('treasury', 'edit'), (req) => controller.reconcile(req))

      // Presupuesto (TES-5)
      router.get('/api/treasury/budgets', guard('treasury', 'view'), (req) => controller.indexBudgets(req))
      router.post('/api/treasury/budgets', guard('treasury', 'create'), (req) => controller.storeBudget(req))
      router.put('/api/treasury/budgets/:id', guard('treasury', 'edit'), (req) => controller.updateBudget(req))
      router.get('/api/treasury/budget-vs-actual', guard('treasury', 'view'), (req) => controller.budgetVsActual(req))

      log.info('Módulo treasury listo')
      return service
    },
  })
}
