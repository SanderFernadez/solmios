// crm/service.ts — CRM engine: points, coupons, segments, LTV

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type {
  LoyaltyTransactionDTO, CouponDTO, CreateCouponDTO,
  GuestSegmentDTO, CreateSegmentDTO,
  GuestLTV, CrmDashboard,
} from './types'
import type { CrmSockets } from './sockets'
import { LtvUseCase } from './usecases/ltv'

export class CrmService {
  private sockets: CrmSockets = {}
  private ltvCalculator: LtvUseCase

  constructor(
    private readonly loyaltyRepo: RepositoryAdapter<LoyaltyTransactionDTO>,
    private readonly couponRepo: RepositoryAdapter<CouponDTO>,
    private readonly segmentRepo: RepositoryAdapter<GuestSegmentDTO>,
    private readonly guestRepo: RepositoryAdapter<any>,
    private readonly reservaRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    private readonly auth?: Auth,
  ) {
    this.ltvCalculator = new LtvUseCase(guestRepo, reservaRepo, logger)
  }

  setSockets(s: Partial<CrmSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) { const h = next[key]; if (!h) continue; const prev = cur[key]; cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h }
  }

  // ─── Auto-checkout from connector ─────────────────────
  async onCheckoutComplete(reserva: any): Promise<void> {
    try { await this.guestRepo.update(reserva.guestId, { totalStays: { increment: 1 }, totalSpent: { increment: reserva.totalAmount ?? 0 } } as any) } catch {}
    await this.awardPoints(reserva.guestId, reserva.hotelId, Math.floor((reserva.totalAmount ?? 0) * 10), `Estadía ${reserva.id}`, reserva.id)
    await this.checkTierUpgrade(reserva.guestId)
  }

  // ─── Points ───────────────────────────────────────────
  async awardPoints(guestId: string, hotelId: string, points: number, description: string, reservationId?: string, role?: string): Promise<LoyaltyTransactionDTO> {
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) throw new NotFoundError('Guest not found')
    if (this.auth) this.auth.assertOwnership(guest.hotelId, hotelId, role, 'super_admin')
    const txn = await this.loyaltyRepo.create({ guestId, hotelId, reservationId: reservationId ?? null, type: 'earn', points, description } as any)
    await this.guestRepo.update(guestId, { loyaltyPoints: { increment: points } } as any)
    await this.checkTierUpgrade(guestId)
    return txn
  }

  async redeemPoints(guestId: string, hotelId: string, points: number, description: string, role?: string): Promise<LoyaltyTransactionDTO> {
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) throw new NotFoundError('Guest not found')
    if (this.auth) this.auth.assertOwnership(guest.hotelId, hotelId, role, 'super_admin')
    if ((guest.loyaltyPoints ?? 0) < points) throw new ValidationError(`Insufficient points. Available: ${guest.loyaltyPoints ?? 0}`)
    const txn = await this.loyaltyRepo.create({ guestId, hotelId, type: 'redeem', points: -points, description } as any)
    await this.guestRepo.update(guestId, { loyaltyPoints: { increment: -points } } as any)
    return txn
  }

  async getPointsHistory(guestId: string, hotelId: string, role?: string): Promise<LoyaltyTransactionDTO[]> {
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) throw new NotFoundError('Guest not found')
    if (this.auth) this.auth.assertOwnership(guest.hotelId, hotelId, role, 'super_admin')
    return this.loyaltyRepo.findMany({ guestId })
  }

  async getPointsBalance(guestId: string, hotelId: string, role?: string): Promise<number> {
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) throw new NotFoundError('Guest not found')
    if (this.auth) this.auth.assertOwnership(guest.hotelId, hotelId, role, 'super_admin')
    return guest.loyaltyPoints ?? 0
  }

  // ─── Tier Management ──────────────────────────────────
  // Internal helper — only reached from awardPoints (ownership already asserted there)
  // or onCheckoutComplete (trusted reserva.guestId from connector). Not routed directly.
  async checkTierUpgrade(guestId: string): Promise<string> {
    // @ignore IDOR_RISK — guestId already validated by caller (see comment above method)
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) return 'bronze'
    const newTier = this.calculateTier(guest.totalStays ?? 0, guest.totalSpent ?? 0)
    if (newTier !== guest.tier && this.tierOrder(newTier) > this.tierOrder(guest.tier)) {
      await this.guestRepo.update(guestId, { tier: newTier } as any)
    }
    return guest.tier ?? 'bronze'
  }

  private calculateTier(stays: number, spent: number): string {
    if (stays >= 20 || spent >= 50000) return 'diamond'
    if (stays >= 10 || spent >= 20000) return 'platinum'
    if (stays >= 5  || spent >= 8000) return 'gold'
    if (stays >= 2  || spent >= 3000) return 'silver'
    return 'bronze'
  }

  private tierOrder(t: string): number { return { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4 }[t] ?? 0 }

  // ─── Coupons ──────────────────────────────────────────
  async createCoupon(dto: CreateCouponDTO): Promise<CouponDTO> {
    return this.couponRepo.create({ ...dto, useCount: 0, active: 1 } as any)
  }

  async getCoupon(id: string, hotelId: string, role?: string): Promise<CouponDTO> {
    const c = await this.couponRepo.findById(id)
    if (!c) throw new NotFoundError('Coupon not found')
    if (this.auth) this.auth.assertOwnership(c.hotelId, hotelId, role, 'super_admin')
    return c
  }

  async listCoupons(hotelId: string): Promise<CouponDTO[]> {
    return this.couponRepo.findMany({ hotelId, active: 1 })
  }

  async validateCoupon(code: string, hotelId: string, purchaseAmount: number): Promise<CouponDTO> {
    const coupons = await this.couponRepo.findMany({ hotelId, code, active: 1 })
    const c = coupons[0]; if (!c) throw new NotFoundError('Coupon not found')
    if (c.maxUses && c.useCount >= c.maxUses) throw new ValidationError('Coupon limit reached')
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) throw new ValidationError('Coupon expired')
    if (c.minPurchase > purchaseAmount) throw new ValidationError(`Minimum purchase: $${c.minPurchase}`)
    return c
  }

  async useCoupon(id: string, hotelId: string, role?: string): Promise<void> {
    const coupon = await this.couponRepo.findById(id)
    if (!coupon) throw new NotFoundError('Coupon not found')
    if (this.auth) this.auth.assertOwnership(coupon.hotelId, hotelId, role, 'super_admin')
    await this.couponRepo.update(id, { useCount: { increment: 1 } } as any)
  }

  async deleteCoupon(id: string, hotelId: string, role?: string): Promise<void> {
    const coupon = await this.couponRepo.findById(id)
    if (!coupon) throw new NotFoundError('Coupon not found')
    if (this.auth) this.auth.assertOwnership(coupon.hotelId, hotelId, role, 'super_admin')
    await this.couponRepo.update(id, { active: 0 } as any)
  }

  // ─── Segments ─────────────────────────────────────────
  async createSegment(dto: CreateSegmentDTO): Promise<GuestSegmentDTO> {
    return this.segmentRepo.create({ ...dto, count: 0, active: 1 } as any)
  }

  async listSegments(hotelId: string): Promise<GuestSegmentDTO[]> {
    return this.segmentRepo.findMany({ hotelId, active: 1 })
  }

  async getGuestsInSegment(hotelId: string, segmentId: string, role?: string): Promise<any[]> {
    const segment = await this.segmentRepo.findById(segmentId)
    if (!segment) throw new NotFoundError('Segment not found')
    if (this.auth) this.auth.assertOwnership(segment.hotelId, hotelId, role, 'super_admin')
    const rules: Record<string, any> = segment.rules ? JSON.parse(segment.rules) : {}
    const filters: Record<string, any> = { hotelId, active: 1 }
    if (rules.minStays) filters.totalStays = { $gte: rules.minStays }
    if (rules.minSpent) filters.totalSpent = { $gte: rules.minSpent }
    if (rules.tier) filters.tier = rules.tier
    return this.guestRepo.findMany(filters)
  }

  // ─── LTV ──────────────────────────────────────────────
  async calculateLTV(hotelId: string, limit = 50): Promise<GuestLTV[]> {
    return this.ltvCalculator.calculate(hotelId, limit)
  }

  // ─── Dashboard ────────────────────────────────────────
  async getDashboard(hotelId: string): Promise<CrmDashboard> {
    const guests = await this.guestRepo.findMany({ hotelId, active: 1 })
    const pointsTxns = await this.loyaltyRepo.findMany({ hotelId })
    const coupons = await this.couponRepo.findMany({ hotelId })

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    let activeThisMonth = 0
    for (const g of guests) {
      const ress = await this.reservaRepo.findMany({ guestId: g.id, hotelId })
      const activeInMonth = ress.filter((r: any) => r.checkIn && r.checkIn >= monthStart).length
      if (activeInMonth > 0) activeThisMonth++
    }

    const topTierCounts: Record<string, number> = {}
    for (const g of guests) { const t = g.tier ?? 'bronze'; topTierCounts[t] = (topTierCounts[t] ?? 0) + 1 }

    return {
      totalGuests: guests.length,
      activeThisMonth,
      totalPointsIssued: pointsTxns.filter(t => t.type === 'earn').reduce((s, t) => s + t.points, 0),
      totalPointsRedeemed: pointsTxns.filter(t => t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0),
      topTierCounts,
      avgLTV: guests.length > 0 ? Math.round(guests.reduce((s, g) => s + (g.totalSpent ?? 0), 0) / guests.length) : 0,
      couponUsageRate: coupons.length > 0 ? Math.round(coupons.reduce((s, c) => s + c.useCount, 0) / coupons.length * 100) / 100 : 0,
    }
  }
}
