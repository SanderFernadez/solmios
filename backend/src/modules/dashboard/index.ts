import { createModule } from 'arckode-framework'
import { DashboardService } from './service'
import { DashboardController } from './controller'
import { DashboardQueries } from './usecases/dashboard-queries'

export { DashboardService }

export function DashboardModule() {
  return createModule({
    name: 'dashboard',
    version: '1.0.0',
    description: 'Dashboard, planning, checkin list - cross-module aggregation',
    contract: {
      name: 'dashboard', version: '1.0.0',
      description: 'Cross-module aggregation endpoints',
      actions: ['getDashboard', 'getPlanning', 'getCheckinList'],
      events: [],
      tables: [],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('dashboard: auth dependency required')
      const log = logger.child('dashboard')
      const queries = new DashboardQueries(orm)
      const service = new DashboardService(log, queries)
      const controller = new DashboardController(service, log)

      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/dashboard', hra, (req: any) => controller.getDashboard(req))
      router.get('/api/planning', hra, (req: any) => controller.getPlanning(req))
      router.get('/api/checkin', hra, (req: any) => controller.getCheckinList(req))

      log.info('Módulo dashboard listo')
      return service
    },
  })
}
