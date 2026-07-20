import { createModule, OrmRepository } from 'arckode-framework'
import { registerSubscriptionModels } from './model'
import { SubscriptionsService } from './service'
import { SubscriptionsController } from './controller'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'
import { verifyCaptcha, isCaptchaEnabled } from '../../infrastructure/captcha'

export { SubscriptionsService }

export function SubscriptionsModule() {
  return createModule({
    name: 'subscriptions',
    version: '1.0.0',
    description: 'Suscripción del hotel a la plataforma: alta pública, prueba gratis y corte de servicio',
    contract: {
      name: 'subscriptions', version: '1.0.0',
      description: 'SaaS subscription lifecycle',
      actions: ['signup', 'publicPlans', 'myStatus', 'onboarding'],
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
        new OrmRepository<any>(orm, 'Rooms'),
        undefined, // tarifas: el módulo de pricing define su propio modelo
        log,
      )
      const controller = new SubscriptionsController(service, log)

      // PÚBLICAS. El alta es la única puerta abierta que escribe en la base, así
      // que va con el mismo rate-limit por IP que el login.
      router.post('/api/public/signup', async (req: any) => {
        const ip = getClientIp(req)
        const key = `signup:${ip}`
        const { allowed, retryAfter } = rateLimit(key)
        if (!allowed) {
          return { status: 429, body: { error: `Demasiados intentos. Probá en ${retryAfter} segundos` } }
        }
        // El captcha se verifica ANTES de validar el resto y antes de tocar la
        // base: es la barrera contra el bot, no tiene sentido gastar consultas
        // ni revelar si un email ya existe si del otro lado no hay una persona.
        if (isCaptchaEnabled()) {
          const captcha = await verifyCaptcha(String(req.body?.captchaToken ?? ''), ip)
          if (!captcha.ok) {
            log.warn(`Signup rechazado por captcha desde ${ip}: ${captcha.reason}`)
            return { status: 400, body: { error: 'No pudimos verificar que no seas un robot. Recargá la página y probá de nuevo.' } }
          }
        }
        return controller.signup(req)
      })
      router.get('/api/public/plans', (req: any) => controller.publicPlans(req))

      // Del hotel logueado: cuánto le queda de prueba / si tiene que pagar.
      router.get('/api/subscription/me', [auth.authenticate()], (req: any) => controller.myStatus(req))
      router.get('/api/onboarding/status', [auth.authenticate()], (req: any) => controller.onboarding(req))

      // Sin secret el alta queda sin captcha: se avisa fuerte porque el modo
      // "sin captcha" es indistinguible a simple vista del modo protegido.
      if (isCaptchaEnabled()) {
        log.info('Captcha del alta: ACTIVO (Turnstile)')
      } else {
        log.warn('Captcha del alta: DESACTIVADO — falta TURNSTILE_SECRET. El registro público solo está protegido por rate-limit por IP.')
      }

      log.info('Módulo subscriptions listo (4 endpoints)')
      return service
    },
  })
}
