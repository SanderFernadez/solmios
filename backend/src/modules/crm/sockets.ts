// crm/sockets.ts
export interface CrmSockets {
  onPointsAwarded?: (guestId: string, points: number) => Promise<void>
  onTierUpgrade?: (guestId: string, oldTier: string, newTier: string) => Promise<void>
  /** `useCoupon` solo conoce el cupón: quién lo usó no llega hasta acá. */
  onCouponUsed?: (couponId: string) => Promise<void>
}
