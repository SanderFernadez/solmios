import { createModule } from 'arckode-framework'
import { PricingService } from './service'
import { PricingController } from './controller'

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
      const service = new PricingService(orm, log)
      const controller = new PricingController(service, log)

      const hsa = [auth.authenticate('hotel_admin', 'super_admin')]
      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/seasons', hra, (req: any) => controller.listSeasons(req))
      router.put('/api/seasons', hsa, (req: any) => controller.updateSeasons(req))
      router.get('/api/rates', hra, (req: any) => controller.listRates(req))
      router.put('/api/rates', hsa, (req: any) => controller.updateRates(req))
      router.post('/api/rates/copy-next-year', hsa, (req: any) => controller.copyRatesNextYear(req))
      router.get('/api/blocks', hra, (req: any) => controller.listBlocks(req))
      router.post('/api/blocks', hsa, (req: any) => controller.createBlocks(req))
      router.delete('/api/blocks/:id', hsa, (req: any) => controller.deleteBlock(req))
      router.get('/api/rate-restrictions', hsa, (req: any) => controller.listRateRestrictions(req))
      router.put('/api/rate-restrictions', hsa, (req: any) => controller.updateRateRestrictions(req))
      router.get('/api/channel-metrics', hsa, (req: any) => controller.getChannelMetrics(req))

      log.info('Módulo pricing listo (11 endpoints)')
      return service
    },
  })
}
