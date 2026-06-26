// services/Crm.service.ts
import { http } from './http'

export interface LoyaltyTransaction {
  id: string; guestId: string; hotelId: string; type: string; points: number; description: string; createdAt: string
}
export interface Coupon {
  id: string; hotelId: string; code: string; type: string; value: number; minPurchase: number; maxUses: number | null
  useCount: number; startsAt: string | null; expiresAt: string | null; pointsCost: number; active: number
}
export interface GuestSegment {
  id: string; hotelId: string; name: string; description: string; rules: string | null; count: number
}
export interface GuestLTV {
  guestId: string; name: string; totalStays: number; totalSpent: number; avgPerStay: number
  loyaltyPoints: number; tier: string; firstVisit: string; lastVisit: string; daysSinceLastVisit: number; ltvScore: number
}
export interface CrmDashboard {
  totalGuests: number; activeThisMonth: number; totalPointsIssued: number; totalPointsRedeemed: number
  topTierCounts: Record<string, number>; avgLTV: number; couponUsageRate: number
}

export const CrmService = {
  // Points
  awardPoints: (guestId: string, points: number, description: string) => http.post('/api/crm/points/award', { guestId, points, description }) as Promise<LoyaltyTransaction>,
  redeemPoints: (guestId: string, points: number, description: string) => http.post('/api/crm/points/redeem', { guestId, points, description }) as Promise<LoyaltyTransaction>,
  getPointsHistory: (guestId: string): Promise<LoyaltyTransaction[]> => http.get(`/api/crm/points/history/${guestId}`),
  getPointsBalance: (guestId: string): Promise<{ balance: number }> => http.get(`/api/crm/points/balance/${guestId}`),

  // Coupons
  listCoupons: (): Promise<Coupon[]> => http.get('/api/crm/coupons'),
  createCoupon: (data: Partial<Coupon>): Promise<Coupon> => http.post('/api/crm/coupons', data),
  validateCoupon: (code: string, amount: number): Promise<Coupon> => http.post('/api/crm/coupons/validate', { code, amount }),
  deleteCoupon: (id: string): Promise<void> => http.delete(`/api/crm/coupons/${id}`),

  // Segments
  listSegments: (): Promise<GuestSegment[]> => http.get('/api/crm/segments'),
  createSegment: (data: Partial<GuestSegment>): Promise<GuestSegment> => http.post('/api/crm/segments', data),
  getGuestsInSegment: (id: string): Promise<any[]> => http.get(`/api/crm/segments/${id}/guests`),

  // LTV + Dashboard
  getLTV: (): Promise<GuestLTV[]> => http.get('/api/crm/ltv'),
  getDashboard: (): Promise<CrmDashboard> => http.get('/api/crm/dashboard'),
}
