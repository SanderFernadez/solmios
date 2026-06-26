// crm/index.ts — PUERTA PÚBLICA
import { createModule, OrmRepository } from 'arckode-framework'
import { registerCrmModels } from './model'
import { CrmService } from './service'
import { CrmController } from './controller'
import type { LoyaltyTransactionDTO, CouponDTO, GuestSegmentDTO } from './types'

export { CrmService }
export type { LoyaltyTransactionDTO, CouponDTO, GuestSegmentDTO, GuestLTV, CrmDashboard, CreateCouponDTO, CreateSegmentDTO } from './types'
export type { CrmSockets } from './sockets'

export function CrmModule() {
  return createModule({
    name: 'crm', version: '1.0.0',
    description: 'CRM y Fidelización — puntos, cupones, segmentación, LTV',

    contract: {
      name: 'crm', version: '1.0.0', description: 'Loyalty + CRM engine',
      actions: ['awardPoints','redeemPoints','getPointsHistory','getPointsBalance','createCoupon','listCoupons','validateCoupon','deleteCoupon','createSegment','listSegments','getGuestsInSegment','calculateLTV','getDashboard'],
      events: ['onPointsAwarded','onTierUpgrade','onCouponUsed'],
      tables: ['loyalty_transactions','coupons','guest_segments'],
      dependencies: ['huespedes','reservas'],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('crm: auth dependency required')
      registerCrmModels(orm)

      const loyaltyRepo = new OrmRepository<LoyaltyTransactionDTO>(orm, 'LoyaltyTransaction')
      const couponRepo = new OrmRepository<CouponDTO>(orm, 'Coupon')
      const segmentRepo = new OrmRepository<GuestSegmentDTO>(orm, 'GuestSegment')
      const guestRepo = new OrmRepository<any>(orm, 'Guests')
      const reservaRepo = new OrmRepository<any>(orm, 'Reservations')

      const log = logger.child('crm')
      const service = new CrmService(loyaltyRepo, couponRepo, segmentRepo, guestRepo, reservaRepo, log, cache)
      const controller = new CrmController(service, log)

      const authd = (roles: string[]) => [auth.authenticate(...roles)]

      router.post('/api/crm/points/award', authd(['hotel_admin', 'super_admin']), (req) => controller.awardPoints(req))
      router.post('/api/crm/points/redeem', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.redeemPoints(req))
      router.get('/api/crm/points/history/:guestId', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.getPointsHistory(req))
      router.get('/api/crm/points/balance/:guestId', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.getPointsBalance(req))

      router.post('/api/crm/coupons', authd(['hotel_admin', 'super_admin']), (req) => controller.createCoupon(req))
      router.get('/api/crm/coupons', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.listCoupons(req))
      router.post('/api/crm/coupons/validate', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.validateCoupon(req))
      router.delete('/api/crm/coupons/:id', authd(['hotel_admin', 'super_admin']), (req) => controller.deleteCoupon(req))

      router.post('/api/crm/segments', authd(['hotel_admin', 'super_admin']), (req) => controller.createSegment(req))
      router.get('/api/crm/segments', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.listSegments(req))
      router.get('/api/crm/segments/:id/guests', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.getGuestsInSegment(req))

      router.get('/api/crm/ltv', authd(['hotel_admin', 'super_admin']), (req) => controller.getLTV(req))
      router.get('/api/crm/dashboard', authd(['hotel_admin', 'receptionist', 'super_admin']), (req) => controller.getDashboard(req))

      log.info('Módulo CRM listo — 3 tablas, 14 endpoints')
      return service
    },
  })
}
