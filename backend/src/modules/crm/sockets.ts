// crm/sockets.ts
export interface CrmSockets {
  onPointsAwarded?: (guestId: string, points: number) => Promise<void>
  onTierUpgrade?: (guestId: string, oldTier: string, newTier: string) => Promise<void>
  onCouponUsed?: (couponId: string, guestId: string) => Promise<void>
}
