// aliados/types.ts — Contratos de la API (distinto de model.ts, que es la BD).

export type PartnerType = 'aliado' | 'aliado_certificado'
export type PayoutMode = 'monthly' | 'one_time'
export type PartnerStatus = 'active' | 'inactive'
export type CommissionStatus = 'pending_payout' | 'active' | 'paid_out' | 'cancelled'
export type CertificationStatus = 'pending' | 'approved' | 'rejected'

export interface PartnerDTO {
  id: string
  hotelId: string
  type: PartnerType
  payoutMode: PayoutMode
  status: PartnerStatus
  becamePartnerAt: string
  certifiedAt: string | null
  createdAt?: string
}

export interface PartnerCommissionDTO {
  id: string
  partnerId: string
  referralId: string
  referredHotelId: string
  percent: number
  payoutMode: PayoutMode
  status: CommissionStatus
  payoutAmount: number | null
  validatedAt: string
  paidAt: string | null
}

export interface PartnerCommissionTierDTO {
  id: string
  fromCount: number
  percent: number
  sortOrder: number
}

export interface PartnerCertificationRequestDTO {
  id: string
  hotelId: string
  status: CertificationStatus
  answers: Record<string, unknown>
  examScore: number | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt?: string
}

export interface EligibilityDTO {
  validatedCount: number
  isEligible: boolean
  alreadyPartner: boolean
}

export interface MyPartnerDTO {
  partner: PartnerDTO | null
  commissions: PartnerCommissionDTO[]
  totalEarned: number
  totalPending: number
}
