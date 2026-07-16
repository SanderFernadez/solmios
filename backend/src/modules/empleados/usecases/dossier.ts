// empleados/usecases/dossier.ts — Expediente integral del empleado (#323).
//
// Vista consolidada de SOLO LECTURA: junta perfil + contratos + documentos + ausencias + evaluaciones
// (manuales y automáticas) de UN empleado en una sola llamada. Es una AGREGACIÓN — va en un usecase
// aparte (no en el service, gate 200 líneas), igual que dashboard.
//
// Reusa los métodos públicos del service (ownership + stripSensitive ya aplicados sobre el perfil) para
// no duplicar lógica. El `evalSummary` se DERIVA de las reviews del sistema ya traídas (reviewerId='system'),
// sin otra query: `performance_reviews` guarda tanto las manuales como las automáticas del motor (#321).

import type {
  EmployeeProfileDTO, ContractDTO, DocumentDTO, LeaveRequestDTO,
  PerformanceReviewDTO, EvalBand, EvalBreakdown,
} from '../types'
import type { EmpleadosService } from '../service'
import type { SimpleUser } from './ownership'

const REVIEWER_SYSTEM = 'system'

/** Resumen de la última evaluación automática del motor de desempeño (#321). */
export interface DossierEvalSummary {
  latestScore: number | null
  band: EvalBand | null
  period: string | null
  reviewDate: string | null
  breakdown: EvalBreakdown | null
  /** Cuántas evaluaciones automáticas tiene asentadas (histórico). */
  totalAutomatic: number
}

/** Expediente consolidado de un empleado. */
export interface EmployeeDossier {
  profile: EmployeeProfileDTO
  contracts: ContractDTO[]
  documents: DocumentDTO[]
  leaveRequests: LeaveRequestDTO[]
  /** Manuales + automáticas (reviewerId='system'), sin filtrar. */
  reviews: PerformanceReviewDTO[]
  evalSummary: DossierEvalSummary | null
}

export class DossierUseCase {
  constructor(private readonly service: EmpleadosService) {}

  async get(id: string, user?: SimpleUser): Promise<EmployeeDossier> {
    // getProfile aplica ownership (assertOwnership por hotelId) y strip de campos sensibles según rol.
    // Si el empleado no es del hotel del usuario → 403; si no existe → 404.
    const profile = await this.service.getProfile(id, user)
    const hotelId = profile.hotelId
    const [contracts, documents, leaveRequests, reviews] = await Promise.all([
      this.service.listContracts(hotelId, id),
      this.service.listDocuments(hotelId, id),
      this.service.listLeaveRequests(hotelId, id),
      this.service.listReviews(hotelId, id),
    ])
    return { profile, contracts, documents, leaveRequests, reviews, evalSummary: summarizeEval(reviews) }
  }
}

/** Toma la evaluación automática más reciente y expone su score/banda/desglose. Sin automáticas → null. */
function summarizeEval(reviews: PerformanceReviewDTO[]): DossierEvalSummary | null {
  const auto = reviews.filter((r) => r.reviewerId === REVIEWER_SYSTEM)
  if (!auto.length) return null
  const latest = auto.reduce((a, b) => ((b.reviewDate ?? '') > (a.reviewDate ?? '') ? b : a))
  let band: EvalBand | null = null
  let breakdown: EvalBreakdown | null = null
  try {
    // `answers` guarda { productivity, quality, punctuality, attendance, band, breakdown } (auto-evaluation.persist).
    const parsed = JSON.parse(latest.answers || '{}') as { band?: EvalBand; breakdown?: EvalBreakdown }
    band = parsed.band ?? null
    breakdown = parsed.breakdown ?? null
  } catch { /* answers corrupto o vacío → summary sin desglose, no rompe el expediente */ }
  return {
    latestScore: latest.score,
    band,
    period: latest.period || null,
    reviewDate: latest.reviewDate || null,
    breakdown,
    totalAutomatic: auto.length,
  }
}
