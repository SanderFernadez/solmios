// payroll/index.ts — PUERTA PÚBLICA
import { createModule, OrmRepository } from 'arckode-framework'
import { registerPayrollModels } from './model'
import { PayrollService } from './service'
import { PayrollController } from './controller'
import type {
  PayrollConfigDTO, PayrollConceptDTO, PayrollRunDTO,
  PayrollRunDetailDTO, PayrollPayslipDTO, PayrollPaymentHistoryDTO,
} from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { PayrollService }
export type {
  PayrollConfigDTO, PayrollConceptDTO, PayrollRunDTO,
  PayrollRunDetailDTO, PayrollPayslipDTO, PayrollPaymentHistoryDTO,
  CreatePayrollConfigDTO, CreatePayrollConceptDTO, CreatePayrollRunDTO,
  PayrollEmployeeInput, PayrollEmployeeResult, PayrollCalculationResult,
  PayrollPrefillPort, PayrollPrefillRow, PayrollEmployeeRef, AttendanceReportInput,
} from './types'
export type { PayrollPaymentMethod } from './types'
export type { PayrollSockets } from './sockets'

export function PayrollModule() {
  return createModule({
    name: 'payroll',
    version: '1.0.0',
    description: 'Nómina automatizada — cálculo, liquidación, recibos, retenciones',

    contract: {
      name: 'payroll', version: '1.0.0',
      description: 'Nómina completa',
      actions: ['getConfig','updateConfig','listConcepts','createConcept','deleteConcept','listRuns','createRun','getRun','getRunDetails','prefill','setPrefillPort','calculate','approve','markAsPaid','cancelRun'],
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
      const service = new PayrollService(configRepo, conceptRepo, runRepo, detailRepo, payslipRepo, paymentHistoryRepo, log, cache, auth)
      const controller = new PayrollController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // Permiso payroll:* (NO billing:*): liquidar sueldos es del hotel_admin, no de recepción.
      // Config
      router.get('/api/payroll/config', guard('payroll', 'view'), (req) => controller.getConfig(req))
      router.put('/api/payroll/config', guard('payroll', 'edit'), (req) => controller.updateConfig(req))

      // Concepts
      router.get('/api/payroll/concepts', guard('payroll', 'view'), (req) => controller.listConcepts(req))
      router.get('/api/payroll/concepts/:id', guard('payroll', 'view'), (req) => controller.getConcept(req))
      router.post('/api/payroll/concepts', guard('payroll', 'create'), (req) => controller.createConcept(req))
      router.delete('/api/payroll/concepts/:id', guard('payroll', 'delete'), (req) => controller.deleteConcept(req))

      // Runs
      router.get('/api/payroll/runs', guard('payroll', 'view'), (req) => controller.listRuns(req))
      router.post('/api/payroll/runs', guard('payroll', 'create'), (req) => controller.createRun(req))
      router.get('/api/payroll/runs/:id', guard('payroll', 'view'), (req) => controller.getRun(req))
      router.get('/api/payroll/runs/:id/details', guard('payroll', 'view'), (req) => controller.getRunDetails(req))
      router.get('/api/payroll/runs/:id/prefill', guard('payroll', 'view'), (req) => controller.prefill(req))
      router.post('/api/payroll/runs/:id/calculate', guard('payroll', 'edit'), (req) => controller.calculate(req))
      router.post('/api/payroll/runs/:id/approve', guard('payroll', 'edit'), (req) => controller.approve(req))
      router.post('/api/payroll/runs/:id/pay', guard('payroll', 'edit'), (req) => controller.markAsPaid(req))
      router.post('/api/payroll/runs/:id/cancel', guard('payroll', 'delete'), (req) => controller.cancelRun(req))

      log.info('Módulo payroll listo — 6 tablas, 16 endpoints')
      return service
    },
  })
}
