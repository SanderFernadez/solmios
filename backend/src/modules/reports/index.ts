import { createModule } from 'arckode-framework'
import { ReportsService } from './service'
import { ReportsController } from './controller'

export { ReportsService }

export function ReportsModule() {
  return createModule({
    name: 'reports',
    version: '1.0.0',
    description: 'Reportes: facturación, ocupación, pernoctaciones, rendimiento',
    contract: {
      name: 'reports', version: '1.0.0',
      description: 'Analytics and reporting engine',
      actions: ['getReports', 'getAdvancedReport', 'exportReport', 'getNightAudit', 'markNoShows'],
      events: [],
      tables: [],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('reports: auth dependency required')
      const log = logger.child('reports')
      const service = new ReportsService(orm, log)
      const controller = new ReportsController(service, log)

      const ha = [auth.authenticate('hotel_admin', 'super_admin')]
      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/reports', ha, (req: any) => controller.getReports(req))
      router.get('/api/reports/advanced', ha, (req: any) => controller.getAdvancedReport(req))
      router.get('/api/reports/export', ha, (req: any) => controller.exportReport(req))

      router.get('/api/night-audit', ha, (req: any) => controller.getNightAudit(req))
      router.post('/api/night-audit/mark-no-shows', ha, () => controller.markNoShows())

      log.info('Módulo reports listo')
      return service
    },
  })
}
