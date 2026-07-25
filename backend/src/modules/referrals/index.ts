import { createModule, OrmRepository } from 'arckode-framework'
import { registerReferralModels } from './model'
import { ReferralsService } from './service'
import { ReferralsController } from './controller'
import { requireUserType } from '../../infrastructure/auth/require-user-type'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { ReferralsService }

export function ReferralsModule() {
  return createModule({
    name: 'referrals',
    version: '1.0.0',
    description: 'Programa de referidos B2B: un hotel recomienda SOLMI OS a otro y gana meses gratis',
    contract: {
      name: 'referrals', version: '1.0.0',
      description: 'Referral program lifecycle',
      actions: ['linkSignup', 'myReferrals', 'getProgram', 'updateProgram', 'listTiers', 'getMetrics'],
      events: [],
      tables: ['referral_codes', 'referrals', 'referral_credits', 'referral_tiers'],
      dependencies: [],
      rules: [
        'linkSignup: acción pública consumida por el connector subscriptions-referrals.ts, nunca vía HTTP directo',
        'admin/*: solo super_admin. merchant/*: mismo permiso que subscriptions/checkout (settings:edit)',
      ],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('referrals: auth dependency required')
      registerReferralModels(orm)
      const log = logger.child('referrals')

      const service = new ReferralsService(
        new OrmRepository<any>(orm, 'ReferralCodes'),
        new OrmRepository<any>(orm, 'Referrals'),
        new OrmRepository<any>(orm, 'ReferralCredits'),
        new OrmRepository<any>(orm, 'ReferralTiers'),
        new OrmRepository<any>(orm, 'Hotels'),
        new OrmRepository<any>(orm, 'Configuration'),
        log,
        auth,
      )
      const controller = new ReferralsController(service, log)

      const sa = [auth.authenticate('super_admin'), requireUserType('admin')]
      // Mismo permiso que subscriptions/checkout: es plata de la suscripción del hotel.
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/admin/referrals/program', sa, () => controller.getProgram())
      router.put('/api/admin/referrals/program', sa, (req: any) => controller.updateProgram(req))
      router.get('/api/admin/referrals/tiers', sa, () => controller.listTiers())
      router.post('/api/admin/referrals/tiers', sa, (req: any) => controller.createTier(req))
      router.put('/api/admin/referrals/tiers/:id', sa, (req: any) => controller.updateTier(req))
      router.delete('/api/admin/referrals/tiers/:id', sa, (req: any) => controller.deleteTier(req))
      router.get('/api/admin/referrals/metrics', sa, () => controller.getMetrics())

      router.get('/api/referrals/me', guard('settings', 'edit'), (req: any) => controller.myReferrals(req))

      router.get('/api/public/referrals/resolve', (req: any) => controller.resolveCode(req))

      log.info('Módulo referrals listo (9 endpoints)')
      return service
    },
  })
}
