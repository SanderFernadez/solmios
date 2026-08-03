import { createModule, OrmRepository } from 'arckode-framework'
import { registerAliadosModels } from './model'
import { AliadosService } from './service'
import { AliadosController } from './controller'
import { DEFAULT_COMMISSION_TIERS } from './usecases/commission-tiers'
import { requireUserType } from '../../infrastructure/auth/require-user-type'

export { AliadosService }

export function AliadosModule() {
  return createModule({
    name: 'aliados',
    version: '1.0.0',
    description: 'Programa Aliados: comisión en dinero por referidos validados, evolución del programa de Referidos (meses gratis)',
    contract: {
      name: 'aliados', version: '1.0.0',
      description: 'Partner commission program lifecycle',
      actions: ['eligibility', 'convert', 'me', 'setPayoutMode', 'applyForCertification', 'listPartners', 'markCommissionPaid'],
      events: [],
      tables: ['partners', 'partner_commissions', 'partner_commission_tiers', 'partner_certification_requests'],
      dependencies: [],
      rules: [
        'Un hotel es Aliado o no lo es (unicidad lógica por hotelId, verificada en convert-to-aliado.ts)',
        'aliado_certificado: payoutMode SIEMPRE monthly, percent SIEMPRE 20 fijo (no escala por tramos)',
        'La conversión a Aliado es MANUAL, nunca automática al cruzar el umbral de elegibilidad',
        'shared/usecases/referral-credits-cron.ts lee la tabla Partners directo por orm.findMany (mismo patrón que otras tablas cross-module desde shared/, no puede importar este módulo)',
      ],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('aliados: auth dependency required')
      registerAliadosModels(orm)
      const log = logger.child('aliados')

      const partnersRepo = new OrmRepository<any>(orm, 'Partners')
      const commissionsRepo = new OrmRepository<any>(orm, 'PartnerCommissions')
      const tiersRepo = new OrmRepository<any>(orm, 'PartnerCommissionTiers')
      const requestsRepo = new OrmRepository<any>(orm, 'PartnerCertificationRequests')
      const referralsRepo = new OrmRepository<any>(orm, 'Referrals')

      const service = new AliadosService(partnersRepo, commissionsRepo, tiersRepo, requestsRepo, referralsRepo, log, auth)
      const controller = new AliadosController(service, log)

      // Seed de arranque de los tramos de comisión — solo si la tabla está vacía (idempotente,
      // mismo criterio check-then-create que scripts/seed-default-roles.ts). Valores de arranque
      // autorizados por el dueño (issue #549), editables después vía PUT /api/admin/aliados/tiers.
      tiersRepo.findMany({}).then(async (existing) => {
        if ((existing as any[]).length > 0) return
        for (const tier of DEFAULT_COMMISSION_TIERS) {
          await tiersRepo.create({
            id: crypto.randomUUID(), fromCount: tier.fromCount, percent: tier.percent, sortOrder: tier.fromCount,
          } as any)
        }
        log.info('Tramos de comisión de Aliados sembrados por defecto', { count: DEFAULT_COMMISSION_TIERS.length })
      }).catch((e: any) => log.warn('No se pudieron sembrar los tramos de comisión de Aliados', { error: e.message }))

      const sa = [auth.authenticate('super_admin'), requireUserType('admin')]
      const merchant = [auth.authenticate('hotel_admin'), requireUserType('merchant')]

      // ─── Hotel-side ───
      router.get('/api/aliados/eligibility', merchant, (req: any) => controller.eligibility(req))
      router.post('/api/aliados/convert', merchant, (req: any) => controller.convert(req))
      router.get('/api/aliados/me', merchant, (req: any) => controller.me(req))
      router.patch('/api/aliados/payout-mode', merchant, (req: any) => controller.setPayoutMode(req))
      router.post('/api/aliados/certification/apply', merchant, (req: any) => controller.applyForCertification(req))

      // ─── Plataforma ───
      router.get('/api/admin/aliados', sa, () => controller.listPartners())
      router.get('/api/admin/aliados/certification-requests', sa, () => controller.listCertificationRequests())
      router.post('/api/admin/aliados/certification-requests/:id/approve', sa, (req: any) => controller.approveCertification(req))
      router.post('/api/admin/aliados/certification-requests/:id/reject', sa, (req: any) => controller.rejectCertification(req))
      router.get('/api/admin/aliados/tiers', sa, () => controller.listTiers())
      router.put('/api/admin/aliados/tiers', sa, (req: any) => controller.replaceTiers(req))
      router.post('/api/admin/aliados/commissions/:id/mark-paid', sa, (req: any) => controller.markCommissionPaid(req))

      log.info('Módulo aliados listo (12 endpoints)')
      return service
    },
  })
}
