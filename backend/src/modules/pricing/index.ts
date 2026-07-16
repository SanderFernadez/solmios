import { createModule, OrmRepository } from 'arckode-framework'
import { PricingService } from './service'
import { PricingController } from './controller'
import { PricingQueries } from './usecases/pricing-queries'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { PricingService }

export function PricingModule() {
  return createModule({
    name: 'pricing',
    version: '1.0.0',
    description: 'Pricing: seasons, rates, blocks, restrictions, channel metrics',
    contract: {
      name: 'pricing', version: '1.0.0',
      description: 'Inventory and pricing management',
      actions: ['listSeasons', 'updateSeasons', 'listRates', 'updateRates', 'copyRatesNextYear', 'listBlocks', 'createBlocks', 'deleteBlock', 'listRateRestrictions', 'updateRateRestrictions', 'getChannelMetrics'],
      events: [],
      tables: ['seasons', 'room_rates', 'room_blocks', 'rate_restrictions'],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('pricing: auth dependency required')
      const log = logger.child('pricing')
      const seasonsRepo = new OrmRepository<any>(orm, 'Seasons')
      const ratesRepo = new OrmRepository<any>(orm, 'RoomRates')
      const blocksRepo = new OrmRepository<any>(orm, 'RoomBlocks')
      const restrictionsRepo = new OrmRepository<any>(orm, 'RateRestrictions')
      const queries = new PricingQueries(orm)
      const service = new PricingService(seasonsRepo, ratesRepo, blocksRepo, restrictionsRepo, log, queries)
      const controller = new PricingController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/seasons', guard('settings', 'view'), (req: any) => controller.listSeasons(req))
      router.put('/api/seasons', guard('settings', 'edit'), (req: any) => controller.updateSeasons(req))
      router.post('/api/seasons/activate', guard('settings', 'edit'), (req: any) => controller.activateSeason(req))
      router.get('/api/rates', guard('settings', 'view'), (req: any) => controller.listRates(req))
      router.put('/api/rates', guard('settings', 'edit'), (req: any) => controller.updateRates(req))
      router.post('/api/rates/copy-next-year', guard('settings', 'edit'), (req: any) => controller.copyRatesNextYear(req))
      router.get('/api/blocks', guard('settings', 'view'), (req: any) => controller.listBlocks(req))
      router.post('/api/blocks', guard('settings', 'create'), (req: any) => controller.createBlocks(req))
      router.delete('/api/blocks/:id', guard('settings', 'delete'), (req: any) => controller.deleteBlock(req))
      router.get('/api/rate-restrictions', guard('settings', 'view'), (req: any) => controller.listRateRestrictions(req))
      router.put('/api/rate-restrictions', guard('settings', 'edit'), (req: any) => controller.updateRateRestrictions(req))
      router.get('/api/channel-metrics', guard('settings', 'view'), (req: any) => controller.getChannelMetrics(req))

      log.info('Módulo pricing listo (11 endpoints)')
      return service
    },
  })
}
