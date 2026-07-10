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
import { CouponUseCase } from './usecases/coupons'
import { applyPoints, nextTier, pointsForStay } from './usecases/loyalty'
import { SegmentUseCase } from './usecases/segments'

export class CrmService {
  private sockets: CrmSockets = {}
  private ltvCalculator: LtvUseCase
  private coupons: CouponUseCase
  private segments: SegmentUseCase

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
    this.coupons = new CouponUseCase({ repo: couponRepo, auth, onUsed: (id) => this.sockets.onCouponUsed?.(id) ?? Promise.resolve() })
    this.segments = new SegmentUseCase({ repo: segmentRepo, guestRepo, auth })
  }

  setSockets(s: Partial<CrmSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) { const h = next[key]; if (!h) continue; const prev = cur[key]; cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h }
  }

  // ─── Auto-checkout from connector ─────────────────────
  /**
   * El conector `reservas-huespedes` ya es best-effort (`.catch()`), así que acá no hace falta
   * tragarse los errores. El `try {} catch {}` que había escondía el bug de los `{ increment }`:
   * el CRM fallaba en silencio en cada checkout.
   */
  async onCheckoutComplete(reserva: any): Promise<void> {
    // @ignore IDOR_RISK — `reserva` viene del conector reservas-huespedes, no de un request.
    const guest = await this.guestRepo.findById(reserva.guestId)
    if (!guest) {
      this.logger.warn('Checkout sin huésped: no se acreditan puntos', { reservationId: reserva.id })
      return
    }

    // Una estadía se acredita UNA vez. Al checkout se puede llegar por dos eventos distintos
    // (`onReservationCheckedOut` y `onReservasUpdated`); sin esto, el reintento duplica puntos.
    const yaAcreditada = await this.loyaltyRepo.findMany({ reservationId: reserva.id, type: 'earn' })
    if (yaAcreditada.length > 0) {
      this.logger.info('Checkout ya acreditado: se omite', { reservationId: reserva.id })
      return
    }

    await this.guestRepo.update(guest.id, {
      totalStays: Number(guest.totalStays ?? 0) + 1,
      totalSpent: Number(guest.totalSpent ?? 0) + (Number(reserva.totalAmount) || 0),
    } as any)

    const puntos = pointsForStay(reserva.totalAmount)
    // Una estadía de cortesía (importe 0) no da puntos, pero sí cuenta para el nivel:
    // `awardPoints` rechaza `points <= 0`, así que el ascenso se recalcula aparte.
    if (puntos > 0) await this.awardPoints(reserva.guestId, reserva.hotelId, puntos, `Estadía ${reserva.id}`, reserva.id)
    else await this.checkTierUpgrade(reserva.guestId)
  }

  // ─── Points ───────────────────────────────────────────
  async awardPoints(guestId: string, hotelId: string, points: number, description: string, reservationId?: string, role?: string): Promise<LoyaltyTransactionDTO> {
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) throw new NotFoundError('Guest not found')
    if (this.auth) this.auth.assertOwnership(guest.hotelId, hotelId, role, 'super_admin')
    if (points <= 0) throw new ValidationError('Los puntos a acreditar deben ser positivos')

    const txn = await this.loyaltyRepo.create({ guestId, hotelId, reservationId: reservationId ?? null, type: 'earn', points, description } as any)
    // Leer, sumar, escribir: el ORM no entiende `{ increment }` — ver usecases/loyalty.ts.
    const balance = applyPoints(guest.loyaltyPoints, points)
    await this.guestRepo.update(guestId, { loyaltyPoints: balance } as any)

    await this.sockets.onPointsAwarded?.(guestId, points)
    await this.checkTierUpgrade(guestId)
    return txn
  }

  async redeemPoints(guestId: string, hotelId: string, points: number, description: string, role?: string): Promise<LoyaltyTransactionDTO> {
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) throw new NotFoundError('Guest not found')
    if (this.auth) this.auth.assertOwnership(guest.hotelId, hotelId, role, 'super_admin')
    if (points <= 0) throw new ValidationError('Los puntos a canjear deben ser positivos')

    const available = Number(guest.loyaltyPoints ?? 0)
    if (available < points) throw new ValidationError(`Insufficient points. Available: ${available}`)

    const txn = await this.loyaltyRepo.create({ guestId, hotelId, type: 'redeem', points: -points, description } as any)
    await this.guestRepo.update(guestId, { loyaltyPoints: applyPoints(available, -points) } as any)
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
  /** Devuelve el nivel VIGENTE tras el cálculo. Antes devolvía el viejo, incluso si acababa de subir. */
  async checkTierUpgrade(guestId: string): Promise<string> {
    // @ignore IDOR_RISK — guestId already validated by caller (see comment above method)
    const guest = await this.guestRepo.findById(guestId)
    if (!guest) return 'bronze'

    const current = guest.tier ?? 'bronze'
    const upgraded = nextTier(current, Number(guest.totalStays ?? 0), Number(guest.totalSpent ?? 0))
    if (upgraded !== current) {
      await this.guestRepo.update(guestId, { tier: upgraded } as any)
      await this.sockets.onTierUpgrade?.(guestId, current, upgraded)
    }
    return upgraded
  }


  // ─── Coupons (delegan a usecases/coupons) ─────────────
  createCoupon(dto: CreateCouponDTO): Promise<CouponDTO> { return this.coupons.create(dto) }
  getCoupon(id: string, hotelId: string, role?: string): Promise<CouponDTO> { return this.coupons.getById(id, hotelId, role) }
  listCoupons(hotelId: string): Promise<CouponDTO[]> { return this.coupons.list(hotelId) }
  validateCoupon(code: string, hotelId: string, purchaseAmount: number): Promise<CouponDTO> { return this.coupons.validate(code, hotelId, purchaseAmount) }
  useCoupon(id: string, hotelId: string, role?: string): Promise<CouponDTO> { return this.coupons.use(id, hotelId, role) }
  deleteCoupon(id: string, hotelId: string, role?: string): Promise<void> { return this.coupons.deactivate(id, hotelId, role) }

  // ─── Segments (delegan a usecases/segments) ───────────
  createSegment(dto: CreateSegmentDTO): Promise<GuestSegmentDTO> { return this.segments.create(dto) }
  listSegments(hotelId: string): Promise<GuestSegmentDTO[]> { return this.segments.list(hotelId) }
  getGuestsInSegment(hotelId: string, segmentId: string, role?: string): Promise<any[]> { return this.segments.guestsIn(hotelId, segmentId, role) }

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
