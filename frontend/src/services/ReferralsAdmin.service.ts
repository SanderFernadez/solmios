import { http } from './http'

export interface ReferralProgram {
  enabled: boolean
  programName: string
  activeMonthsRequired: number
  requirePaidStatus: boolean
  referredRewardValue: number
  maxAccumulatedMonths: number | null
  creditExpiresMonths: number | null
  clawbackWindowDays: number
}

export interface ReferralTier {
  id: string
  fromCount: number
  monthsGranted: number
  sortOrder: number
}

export interface ReferralMetrics {
  totalReferrals: number
  validatedCount: number
  conversionPct: number
  totalMonthsGranted: number
  topReferrers: Array<{ hotelId: string; hotelName: string; validatedCount: number }>
}

// Admin del programa de Referidos (PLAN-REFERIDOS.md) — /api/admin/referrals/*, solo super_admin.
export const ReferralsAdminService = {
  getProgram: () => http.get<ReferralProgram>('/admin/referrals/program'),
  updateProgram: (patch: Partial<ReferralProgram>) => http.put<ReferralProgram>('/admin/referrals/program', patch),
  listTiers: () => http.get<{ data: ReferralTier[]; total: number }>('/admin/referrals/tiers'),
  createTier: (payload: { fromCount: number; monthsGranted: number; sortOrder?: number }) =>
    http.post<ReferralTier>('/admin/referrals/tiers', payload),
  updateTier: (id: string, payload: Partial<ReferralTier>) => http.put<ReferralTier>(`/admin/referrals/tiers/${id}`, payload),
  deleteTier: (id: string) => http.delete<{ success: boolean }>(`/admin/referrals/tiers/${id}`),
  getMetrics: () => http.get<ReferralMetrics>('/admin/referrals/metrics'),
}
