// accounting/index.ts — PUERTA PÚBLICA del módulo de contabilidad.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerAccountingModels } from './model'
import { AccountingService } from './service'
import { AccountingController } from './controller'
import type { AccountDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { AccountingService }
export type { AccountDTO, CreateAccountDTO, UpdateAccountDTO, AccountsQuery, AccountsPaginated, AccountType } from './types'
export type { AccountingSockets } from './sockets'
export { AccountingValidator, CreateAccountSchema, UpdateAccountSchema } from './validators/schema'
export { registerAccountingModels } from './model'

export function AccountingModule() {
  return createModule({
    name: 'accounting',
    version: '1.0.0',
    description: 'Contabilidad de doble entrada (plan de cuentas, asientos, estados financieros)',

    contract: {
      name: 'accounting',
      version: '1.0.0',
      description: 'Contabilidad de doble entrada',
      actions: ['listAccounts', 'getAccount', 'createAccount', 'updateAccount', 'deleteAccount'],
      events: ['onAccountCreated', 'onAccountUpdated', 'onJournalEntryPosted'],
      tables: ['accounts', 'journal_entries', 'journal_lines', 'accounting_periods'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Todo asiento cumple SUM(debit)=SUM(credit)'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('accounting: auth dependency required')
      registerAccountingModels(orm)

      const accounts = new OrmRepository<AccountDTO>(orm, 'Accounts')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const lines = new OrmRepository<any>(orm, 'JournalLines')
      const log = logger.child('accounting')
      const service = new AccountingService(accounts, userRepo, log, cache, auth, lines)
      const controller = new AccountingController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('accounting')]

      // Plan de cuentas (chart of accounts)
      router.get('/api/accounting/accounts', guard('accounting', 'view'), (req) => controller.indexAccounts(req))
      router.get('/api/accounting/accounts/:id', guard('accounting', 'view'), (req) => controller.showAccount(req))
      router.post('/api/accounting/accounts', guard('accounting', 'create'), (req) => controller.storeAccount(req))
      router.put('/api/accounting/accounts/:id', guard('accounting', 'edit'), (req) => controller.updateAccount(req))
      router.delete('/api/accounting/accounts/:id', guard('accounting', 'delete'), (req) => controller.destroyAccount(req))

      log.info('Módulo accounting listo')
      return service
    },
  })
}
