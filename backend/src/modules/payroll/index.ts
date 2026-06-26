// payroll/index.ts — PUERTA PÚBLICA
import { createModule, OrmRepository } from 'arckode-framework'
import { registerPayrollModels } from './model'
import { PayrollService } from './service'
import { PayrollController } from './controller'
import type {
  PayrollConfigDTO, PayrollConceptDTO, PayrollRunDTO,
  PayrollRunDetailDTO, PayrollPayslipDTO, PayrollPaymentHistoryDTO,
} from './types'

export { PayrollService }
export type {
  PayrollConfigDTO, PayrollConceptDTO, PayrollRunDTO,
  PayrollRunDetailDTO, PayrollPayslipDTO, PayrollPaymentHistoryDTO,
  CreatePayrollConfigDTO, CreatePayrollConceptDTO, CreatePayrollRunDTO,
  PayrollEmployeeInput, PayrollEmployeeResult, PayrollCalculationResult,
} from './types'
export type { PayrollSockets } from './sockets'

export function PayrollModule() {
  return createModule({
    name: 'payroll',
    version: '1.0.0',
    description: 'Nómina automatizada — cálculo, liquidación, recibos, retenciones',

    contract: {
      name: 'payroll', version: '1.0.0',
      description: 'Nómina completa',
      actions: ['getConfig','updateConfig','listConcepts','createConcept','deleteConcept','listRuns','createRun','getRun','getRunDetails','calculate','approve','markAsPaid','cancelRun'],
      events: ['onRunCreated','onRunApproved','onRunPaid'],
      tables: ['payroll_config','payroll_concepts','payroll_runs','payroll_run_details','payroll_payslips','payroll_payment_history'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('payroll: auth dependency required')
      registerPayrollModels(orm)

      const configRepo = new OrmRepository<PayrollConfigDTO>(orm, 'PayrollConfig')
      const conceptRepo = new OrmRepository<PayrollConceptDTO>(orm, 'PayrollConcept')
      const runRepo = new OrmRepository<PayrollRunDTO>(orm, 'PayrollRun')
      const detailRepo = new OrmRepository<PayrollRunDetailDTO>(orm, 'PayrollRunDetail')
      const payslipRepo = new OrmRepository<PayrollPayslipDTO>(orm, 'PayrollPayslip')
      const paymentHistoryRepo = new OrmRepository<PayrollPaymentHistoryDTO>(orm, 'PayrollPaymentHistory')

      const log = logger.child('payroll')
      const service = new PayrollService(configRepo, conceptRepo, runRepo, detailRepo, payslipRepo, paymentHistoryRepo, log, cache)
      const controller = new PayrollController(service, log)

      // Config
      router.get('/api/payroll/config', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getConfig(req))
      router.put('/api/payroll/config', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.updateConfig(req))

      // Concepts
      router.get('/api/payroll/concepts', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.listConcepts(req))
      router.get('/api/payroll/concepts/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getConcept(req))
      router.post('/api/payroll/concepts', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.createConcept(req))
      router.delete('/api/payroll/concepts/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deleteConcept(req))

      // Runs
      router.get('/api/payroll/runs', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.listRuns(req))
      router.post('/api/payroll/runs', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.createRun(req))
      router.get('/api/payroll/runs/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.getRun(req))
      router.get('/api/payroll/runs/:id/details', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.getRunDetails(req))
      router.post('/api/payroll/runs/:id/calculate', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.calculate(req))
      router.post('/api/payroll/runs/:id/approve', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.approve(req))
      router.post('/api/payroll/runs/:id/pay', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.markAsPaid(req))
      router.post('/api/payroll/runs/:id/cancel', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.cancelRun(req))

      log.info('Módulo payroll listo — 6 tablas, 13 endpoints')
      return service
    },
  })
}
