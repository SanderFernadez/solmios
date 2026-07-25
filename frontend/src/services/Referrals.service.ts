import { http } from './http'

export type ReferralStatus = 'trial' | 'active' | 'validated' | 'churned'
export type ReferralCreditStatus = 'pending' | 'released' | 'revoked'

export interface Referral {
  id: string
  referrerHotelId: string
  referredHotelId: string
  referredHotelName: string
  code: string
  status: ReferralStatus
  activeSince: string | null
  validatedAt: string | null
  createdAt?: string
}

export interface ReferralCredit {
  id: string
  referralId: string
  referrerHotelId: string
  monthsGranted: number
  status: ReferralCreditStatus
  basePlanId: string | null
  baseAmount: number | null
  earnedAt: string
  releasedAt: string | null
}

export interface MyReferrals {
  code: string
  shareLink: string
  referrals: Referral[]
  credits: ReferralCredit[]
  totalMonthsEarned: number
  nextTierMonths: number | null
  referralsUntilNextTier: number | null
}

// Programa de Referidos, lado del hotel — /api/referrals/*.
export const ReferralsService = {
  me: () => http.get<MyReferrals>('/referrals/me'),
  resolve: (code: string) => http.get<{ referrerHotelName: string }>(`/public/referrals/resolve?code=${encodeURIComponent(code)}`),
}
