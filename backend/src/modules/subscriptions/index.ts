import { createModule, OrmRepository } from 'arckode-framework'
import { registerSubscriptionModels } from './model'
import { SubscriptionsService } from './service'
import { SubscriptionsController } from './controller'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'

export { SubscriptionsService }

export function SubscriptionsModule() {
  return createModule({
    name: 'subscriptions',
    version: '1.0.0',
    description: 'Suscripción del hotel a la plataforma: alta pública, prueba gratis y corte de servicio',
    contract: {
      name: 'subscriptions', version: '1.0.0',
      description: 'SaaS subscription lifecycle',
      actions: ['signup', 'publicPlans', 'myStatus'],
      events: [],
      tables: ['subscriptions'],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('subscriptions: auth dependency required')
      registerSubscriptionModels(orm)
      const log = logger.child('subscriptions')

      const service = new SubscriptionsService(
        new OrmRepository<any>(orm, 'Subscriptions'),
        new OrmRepository<any>(orm, 'Hotels'),
        new OrmRepository<any>(orm, 'Users'),
        new OrmRepository<any>(orm, 'Roles'),
        new OrmRepository<any>(orm, 'Plans'),
        log,
      )
      const controller = new SubscriptionsController(service, log)

      // PÚBLICAS. El alta es la única puerta abierta que escribe en la base, así
      // que va con el mismo rate-limit por IP que el login.
      router.post('/api/public/signup', async (req: any) => {
        const key = `signup:${getClientIp(req)}`
        const { allowed, retryAfter } = rateLimit(key)
        if (!allowed) {
          return { status: 429, body: { error: `Demasiados intentos. Probá en ${retryAfter} segundos` } }
        }
        return controller.signup(req)
      })
      router.get('/api/public/plans', (req: any) => controller.publicPlans(req))

      // Del hotel logueado: cuánto le queda de prueba / si tiene que pagar.
      router.get('/api/subscription/me', [auth.authenticate()], (req: any) => controller.myStatus(req))

      log.info('Módulo subscriptions listo (3 endpoints)')
      return service
    },
  })
}
