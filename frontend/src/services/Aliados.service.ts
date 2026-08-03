import { http } from './http'

// Tipos calcados de backend/src/modules/aliados/types.ts (mismos nombres de campo).
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
  // Resuelto server-side (my-partner.ts) para no tener que pegarle a /usuarios u otro
  // endpoint desde acá — puede faltar si el backend desplegado todavía no lo resuelve.
  referredHotelName?: string
  percent: number
  payoutMode: PayoutMode
  status: CommissionStatus
  payoutAmount: number | null
  validatedAt: string
  paidAt: string | null
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

// #559 — soporte de Aliado Certificado a sus hoteles referidos.
export interface ReferredHotelDTO {
  hotelId: string
  name: string
  address: string | null
  descriptionJson: string | null
  latitude: number | null
  longitude: number | null
  photoCount: number
}

// Programa Aliados, lado del hotel — /api/aliados/* (evolución de Referrals.service.ts:
// comisión en dinero en vez de meses gratis, para hoteles con >5 referidos validados).
export const AliadosService = {
  eligibility: () => http.get<EligibilityDTO>('/aliados/eligibility'),
  convert: () => http.post<PartnerDTO>('/aliados/convert'),
  me: () => http.get<MyPartnerDTO>('/aliados/me'),
  setPayoutMode: (mode: PayoutMode) => http.patch<PartnerDTO>('/aliados/payout-mode', { mode }),
  applyForCertification: (answers: Record<string, unknown>) =>
    http.post<PartnerCertificationRequestDTO>('/aliados/certification/apply', { answers }),

  // #559 — solo devuelve datos si el hotel logueado es aliado_certificado activo (el backend
  // rechaza con 400/AuthError en cualquier otro caso).
  myReferredHotels: () => http.get<ReferredHotelDTO[]>('/aliados/my-hotels'),
  updateReferredHotel: (hotelId: string, patch: Partial<Pick<ReferredHotelDTO, 'descriptionJson' | 'address' | 'latitude' | 'longitude'>>) =>
    http.patch<ReferredHotelDTO>(`/aliados/my-hotels/${hotelId}`, patch),
  escalateReferredHotel: (hotelId: string, comment: string) =>
    http.post<{ success: boolean }>(`/aliados/my-hotels/${hotelId}/escalate`, { comment }),
}
