// crm/model.ts — Loyalty points + coupons + segments
import type { ModelDefinition, ORM } from 'arckode-framework'

const LoyaltyTransactionModel: ModelDefinition = {
  table: 'loyalty_transactions',
  fields: {
    guestId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    reservationId: { type: 'string' },
    type: { type: 'string', required: true },
    points: { type: 'number', required: true },
    description: { type: 'string' },
    expiresAt: { type: 'string' },
    redeemed: { type: 'boolean', default: 0 },
  },
  timestamps: true,
}

const CouponModel: ModelDefinition = {
  table: 'coupons',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    code: { type: 'string', required: true },
    type: { type: 'string', required: true },
    value: { type: 'number', required: true },
    minPurchase: { type: 'number', default: 0 },
    maxUses: { type: 'number' },
    useCount: { type: 'number', default: 0 },
    startsAt: { type: 'string' },
    expiresAt: { type: 'string' },
    segmentId: { type: 'string' },
    pointsCost: { type: 'number', default: 0 },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

const SegmentModel: ModelDefinition = {
  table: 'guest_segments',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    description: { type: 'string' },
    rules: { type: 'string' },
    count: { type: 'number', default: 0 },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

export function registerCrmModels(orm: ORM): void {
  orm.define('LoyaltyTransaction', LoyaltyTransactionModel)
  orm.define('Coupon', CouponModel)
  orm.define('GuestSegment', SegmentModel)
}
