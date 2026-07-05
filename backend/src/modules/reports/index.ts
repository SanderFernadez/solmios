import { createModule, OrmRepository } from 'arckode-framework'
import { ReportsService } from './service'
import { ReportsController } from './controller'
import { ReportQueries } from './usecases/report-queries'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

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
      const queries = new ReportQueries(orm)
      const service = new ReportsService(log, queries)
      const controller = new ReportsController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/reports', guard('reports', 'view'), (req: any) => controller.getReports(req))
      router.get('/api/reports/advanced', guard('reports', 'view'), (req: any) => controller.getAdvancedReport(req))
      router.get('/api/reports/export', guard('reports', 'export'), (req: any) => controller.exportReport(req))

      router.get('/api/night-audit', guard('reports', 'view'), (req: any) => controller.getNightAudit(req))
      router.post('/api/night-audit/mark-no-shows', guard('reports', 'edit'), (req: any) => controller.markNoShows(req))

      log.info('Módulo reports listo')
      return service
    },
  })
}
