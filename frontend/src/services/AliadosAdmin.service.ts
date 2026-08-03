import { http } from './http'
import type { PartnerDTO, PartnerCommissionDTO, PartnerCertificationRequestDTO } from './Aliados.service'

export interface PartnerCommissionTierDTO {
  id: string
  fromCount: number
  percent: number
  sortOrder: number
}

// Admin del programa Aliados (issue #549) — /api/admin/aliados/*, solo super_admin.
// Mismo patrón que ReferralsAdmin.service.ts, con la diferencia de que los tramos se
// reemplazan TODOS juntos con un PUT (replaceTiers), no create/update/delete individual.
export const AliadosAdminService = {
  listPartners: () => http.get<{ data: PartnerDTO[]; total: number }>('/admin/aliados'),
  listCertificationRequests: () =>
    http.get<{ data: PartnerCertificationRequestDTO[]; total: number }>('/admin/aliados/certification-requests'),
  approveCertification: (id: string) => http.post<PartnerDTO>(`/admin/aliados/certification-requests/${id}/approve`),
  rejectCertification: (id: string) => http.post<PartnerCertificationRequestDTO>(`/admin/aliados/certification-requests/${id}/reject`),
  listTiers: () => http.get<{ data: PartnerCommissionTierDTO[]; total: number }>('/admin/aliados/tiers'),
  replaceTiers: (items: Array<{ fromCount: number; percent: number; sortOrder?: number }>) =>
    http.put<PartnerCommissionTierDTO[]>('/admin/aliados/tiers', items),
  markCommissionPaid: (id: string) => http.post<PartnerCommissionDTO>(`/admin/aliados/commissions/${id}/mark-paid`),
}
