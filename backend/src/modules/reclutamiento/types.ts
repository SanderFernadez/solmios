// reclutamiento/types.ts — DTOs del módulo de reclutamiento.

export const APPLICANT_STAGES = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const
export type ApplicantStage = typeof APPLICANT_STAGES[number]

export interface ApplicantDTO {
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

export interface CreateApplicantDTO {
  hotelId: string
  jobPositionId?: string
  name: string
  email?: string
  phone?: string
  source?: string
  rating?: number
  cvUrl?: string
  notes?: string
}

export interface UpdateApplicantDTO {
  jobPositionId?: string
  name?: string
  email?: string
  phone?: string
  source?: string
  stage?: string
  rating?: number
  cvUrl?: string
  notes?: string
}

// Alias que el index exporta — mantiene el contrato público del módulo.
export type ReclutamientoDTO = ApplicantDTO
export type CreateReclutamientoDTO = CreateApplicantDTO
export type UpdateReclutamientoDTO = UpdateApplicantDTO

export interface ReclutamientoQuery {
  hotelId?: string
  jobPositionId?: string
  stage?: string
  page?: number
  limit?: number
}

export interface ReclutamientoPaginated {
  data: ApplicantDTO[]
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
}

/** Resumen del pipeline: cuántos postulantes en cada etapa. */
export interface PipelineSummary {
  stage: string
  count: number
}
