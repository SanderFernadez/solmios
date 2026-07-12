// Reclutamiento.service.ts — Cliente del módulo de reclutamiento (pipeline de selección).
import { http } from './http'

export interface Applicant {
  id: string
  hotelId: string
  jobPositionId: string | null
  name: string
  email: string
  phone: string
  source: string
  stage: string
  rating: number
  cvUrl: string
  notes: string
  rejectReason: string
  hiredEmployeeId: string | null
  active: number
  createdAt: string
  updatedAt: string
}

export interface PipelineStage { stage: string; count: number }

export const ReclutamientoService = {
  async list(params?: { jobPositionId?: string; stage?: string }): Promise<Applicant[]> {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return http.get(`/api/applicants${qs}`)
  },
  async pipeline(): Promise<PipelineStage[]> { return http.get('/api/applicants/pipeline') },
  async create(data: Partial<Applicant>): Promise<Applicant> { return http.post('/api/applicants', data) },
  async update(id: string, data: Partial<Applicant>): Promise<Applicant> { return http.put(`/api/applicants/${id}`, data) },
  async moveStage(id: string, stage: string): Promise<Applicant> { return http.post(`/api/applicants/${id}/stage`, { stage }) },
  async reject(id: string, reason: string): Promise<Applicant> { return http.post(`/api/applicants/${id}/reject`, { reason }) },
  async hire(id: string, hiredEmployeeId?: string): Promise<Applicant> { return http.post(`/api/applicants/${id}/hire`, { hiredEmployeeId }) },
  async remove(id: string): Promise<void> { return http.delete(`/api/applicants/${id}`) },
}
