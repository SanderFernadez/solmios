import { createModule, OrmRepository } from 'arckode-framework'
import type { PlanDTO, AmenityCatalogDTO } from './types'
import { AdminService } from './service'
import { AdminController } from './controller'
import { DashboardQueries } from './usecases/dashboard-queries'

export { AdminService }

export function AdminModule() {
  return createModule({
    name: 'admin',
    version: '1.0.0',
    description: 'Super admin platform management',
    contract: {
      name: 'admin', version: '1.0.0',
      description: 'Platform-level management: hotels, users, plans, analytics',
      actions: ['listHotels', 'listUsers', 'getAnalytics', 'listSubscriptions', 'listAuditLogs', 'listAnnouncements', 'getMonitoring', 'listPlans', 'createPlan', 'updatePlan', 'deletePlan', 'listAmenitiesCatalog', 'createAmenityCatalog', 'updateAmenityCatalog', 'deleteAmenityCatalog', 'getPublicUsers'],
      events: [],
      tables: [],
      dependencies: [],
      rules: ['Super_admin only'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('admin: auth dependency required')
      const log = logger.child('admin')
      const plansRepo = new OrmRepository<PlanDTO>(orm, 'Plans')
      const amenitiesRepo = new OrmRepository<AmenityCatalogDTO>(orm, 'AmenitiesCatalog')
      const queries = new DashboardQueries(orm)
      const service = new AdminService(plansRepo, amenitiesRepo, log, auth, queries)
      const controller = new AdminController(service, log)

      const sa = [auth.authenticate('super_admin')]
      const ar = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/admin/hoteles', sa, () => controller.listHotels())
      router.get('/api/admin/users', sa, () => controller.listUsers())
      router.get('/api/admin/analytics', sa, () => controller.getAnalytics())
      router.get('/api/admin/subscriptions', sa, () => controller.listSubscriptions())
      router.get('/api/admin/audit', sa, () => controller.listAuditLogs())
      router.get('/api/admin/announcements', sa, () => controller.listAnnouncements())
      router.get('/api/admin/monitoring', sa, () => controller.getMonitoring())
      router.get('/api/admin/plans', sa, () => controller.listPlans())
      router.post('/api/admin/plans', sa, (req: any) => controller.createPlan(req))
      router.put('/api/admin/plans/:id', sa, (req: any) => controller.updatePlan(req))
      router.delete('/api/admin/plans/:id', sa, (req: any) => controller.deletePlan(req))
      router.get('/api/admin/amenities/catalog', sa, () => controller.listAmenitiesCatalog())
      router.post('/api/admin/amenities/catalog', sa, (req: any) => controller.createAmenityCatalog(req))
      router.put('/api/admin/amenities/catalog/:id', sa, (req: any) => controller.updateAmenityCatalog(req))
      router.delete('/api/admin/amenities/catalog/:id', sa, (req: any) => controller.deleteAmenityCatalog(req))
      router.get('/api/public/users', () => controller.getPublicUsers())

      log.info('Módulo admin listo (15 endpoints)')
      return service
    },
  })
}
