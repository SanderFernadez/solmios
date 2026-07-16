// empleados/usecases/auto-evaluation.ts — Motor de evaluación automática de desempeño (#321).
//
// Deriva un score 0-100 de DATA REAL que el sistema ya captura (housekeeping + attendance),
// ponderado por la config del hotel (#322), y asienta un performance_reviews con reviewerId='system'.
// Idempotente por (employeeId, period): re-correr el período ACTUALIZA la evaluación automática, no duplica.
//
// Los puertos hacia housekeeping/attendance se inyectan por connector (empleados no importa esos módulos).
// Join de claves — DISTINTAS por módulo:
//   · housekeeping.staffId  === users.id        → se busca por profile.userId
//   · attendance.employeeId === employee_profiles.id → se busca por profile.id

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EvalConfigUseCase } from './eval-config'
import type {
  EmployeeProfileDTO, PerformanceReviewDTO,
  EvalWeights, EvalThresholds, EvalBand, EvalBreakdown, EvalCriterionResult,
  AutoEvalResult, AutoEvalSummary, EvalPeriodType, PerformanceEvalConfigDTO,
} from '../types'

const REVIEWER_SYSTEM = 'system'
const MS_PER_MINUTE = 60_000

/** Métricas de limpieza por camarera (staffId = users.id). Lo provee el connector empleados-housekeeping. */
export interface HkStaffStat {
  staffId: string
  completed: number
  avgDurationMs: number
  avgRating: number | null
}
export interface HkStatsPort {
  getStaffStats(hotelId: string, from: string, to: string): Promise<HkStaffStat[]>
}

/** Métricas de asistencia por empleado (employeeId = employee_profiles.id). Connector empleados-attendance. */
export interface AttStaffStat {
  employeeId: string
  present: number
  absent: number
  late: number
}
export interface AttendanceStatsPort {
  getStaffAttendance(hotelId: string, from: string, to: string): Promise<AttStaffStat[]>
}

/** Score acotado a [0,100]. */
function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

export class AutoEvaluationUseCase {
  private hkPort?: HkStatsPort
  private attPort?: AttendanceStatsPort

  constructor(
    private readonly config: EvalConfigUseCase,
    private readonly reviewRepo: RepositoryAdapter<PerformanceReviewDTO>,
    private readonly profileRepo: RepositoryAdapter<EmployeeProfileDTO>,
    private readonly logger: Logger,
  ) {}

  // Inyectados por connector. Sin ellos el criterio correspondiente simplemente no tiene data.
  setHousekeepingPort(port: HkStatsPort): void { this.hkPort = port }
  setAttendancePort(port: AttendanceStatsPort): void { this.attPort = port }

  /** Corre la evaluación del período (actual por defecto) para TODOS los empleados activos del hotel. */
  async run(hotelId: string, periodType?: EvalPeriodType): Promise<AutoEvalSummary> {
    const cfg = await this.config.get(hotelId)
    const type = periodType ?? cfg.period
    const { label, fromIso, toIso, fromDate, toDate } = periodBounds(type)

    const [profiles, hkStats, attStats] = await Promise.all([
      this.profileRepo.findMany({ hotelId, active: 1 } as any),
      this.hkPort ? this.hkPort.getStaffStats(hotelId, fromIso, toIso) : Promise.resolve([] as HkStaffStat[]),
      this.attPort ? this.attPort.getStaffAttendance(hotelId, fromDate, toDate) : Promise.resolve([] as AttStaffStat[]),
    ])

    const hkByStaff = new Map(hkStats.map((s) => [s.staffId, s]))
    const attByEmployee = new Map(attStats.map((s) => [s.employeeId, s]))

    const results: AutoEvalResult[] = []
    let skipped = 0
    for (const profile of profiles) {
      const hk = hkByStaff.get(profile.userId)
      const att = attByEmployee.get(profile.id)
      const scored = scoreEmployee(cfg, hk, att)
      if (!scored) { skipped++; continue } // sin data en ningún criterio → no se inventa un score
      const review = await this.persist(hotelId, profile.id, label, scored)
      results.push({ employeeId: profile.id, reviewId: review.id, score: scored.score, band: scored.band, breakdown: scored.breakdown })
    }

    this.logger.info('Auto-evaluación completada', { hotelId, period: label, evaluated: results.length, skipped })
    return { hotelId, period: label, periodType: type, evaluated: results.length, skipped, results }
  }

  /** Evaluaciones automáticas ya asentadas (reviewerId='system'), opcionalmente de un período. */
  async listResults(hotelId: string, period?: string): Promise<PerformanceReviewDTO[]> {
    const filters: Record<string, unknown> = { hotelId, reviewerId: REVIEWER_SYSTEM }
    if (period) filters.period = period
    return this.reviewRepo.findMany(filters)
  }

  /** Crea o actualiza la evaluación automática del período (idempotente por employeeId+period). */
  private async persist(
    hotelId: string,
    employeeId: string,
    period: string,
    scored: ScoredEmployee,
  ): Promise<PerformanceReviewDTO> {
    const answers = JSON.stringify({
      productivity: scored.breakdown.productivity.score,
      quality: scored.breakdown.quality.score,
      punctuality: scored.breakdown.punctuality.score,
      attendance: scored.breakdown.attendance.score,
      band: scored.band,
      breakdown: scored.breakdown,
    })
    const record = {
      hotelId,
      employeeId,
      reviewerId: REVIEWER_SYSTEM,
      period,
      reviewDate: new Date().toISOString(),
      score: scored.score,
      notes: scored.notes,
      answers,
      status: 'completed',
    }
    // findOne scoped por hotelId+employeeId+period (no findById → sin IDOR): si ya existe la del sistema, la pisa.
    const existing = await this.reviewRepo.findOne({ hotelId, employeeId, period, reviewerId: REVIEWER_SYSTEM })
    if (existing) return this.reviewRepo.update(existing.id, record as any) as Promise<PerformanceReviewDTO>
    return this.reviewRepo.create(record as any)
  }
}

interface ScoredEmployee {
  score: number
  band: EvalBand
  breakdown: EvalBreakdown
  notes: string
}

/**
 * Score ponderado renormalizado sobre los criterios CON data. Si un criterio no tiene data,
 * su peso sale del denominador (no se asume 0 ni 100). Sin ningún criterio con data → null (se omite).
 */
function scoreEmployee(cfg: PerformanceEvalConfigDTO, hk?: HkStaffStat, att?: AttStaffStat): ScoredEmployee | null {
  const w = cfg.weights
  const breakdown: EvalBreakdown = {
    productivity: productivityScore(hk, cfg.standardTaskMinutes, w),
    quality: qualityScore(hk, w),
    punctuality: punctualityScore(att, w),
    attendance: attendanceScore(att, w),
  }

  let weighted = 0
  let totalWeight = 0
  for (const key of Object.keys(breakdown) as (keyof EvalBreakdown)[]) {
    const c = breakdown[key]
    if (!c.hasData) continue
    weighted += c.score * c.weight
    totalWeight += c.weight
  }
  if (totalWeight === 0) return null

  const score = Math.round(weighted / totalWeight)
  return { score, band: bandOf(score, cfg.thresholds), breakdown, notes: buildNotes(breakdown, score) }
}

/** Productividad: tiempo real por tarea vs estándar. A tiempo o mejor = 100; más lento escala hacia abajo. */
function productivityScore(hk: HkStaffStat | undefined, standardTaskMinutes: number, w: EvalWeights): EvalCriterionResult {
  if (!hk || hk.completed <= 0 || hk.avgDurationMs <= 0) return { score: 0, weight: w.productivity, hasData: false }
  const avgMinutes = hk.avgDurationMs / MS_PER_MINUTE
  const score = clamp100((standardTaskMinutes / avgMinutes) * 100)
  return { score: Math.round(score), weight: w.productivity, hasData: true }
}

/** Calidad: promedio del rating del supervisor (1-10) × 10. Sin ratings → sin data (se renormaliza). */
function qualityScore(hk: HkStaffStat | undefined, w: EvalWeights): EvalCriterionResult {
  if (!hk || hk.avgRating == null) return { score: 0, weight: w.quality, hasData: false }
  return { score: Math.round(clamp100(hk.avgRating * 10)), weight: w.quality, hasData: true }
}

/** Puntualidad: % de asistencias a tiempo = present/(present+late). */
function punctualityScore(att: AttStaffStat | undefined, w: EvalWeights): EvalCriterionResult {
  const attended = att ? att.present + att.late : 0
  if (!att || attended <= 0) return { score: 0, weight: w.punctuality, hasData: false }
  return { score: Math.round(clamp100((att.present / attended) * 100)), weight: w.punctuality, hasData: true }
}

/** Asistencia: % de presencia = present/(present+absent). */
function attendanceScore(att: AttStaffStat | undefined, w: EvalWeights): EvalCriterionResult {
  const scheduled = att ? att.present + att.absent : 0
  if (!att || scheduled <= 0) return { score: 0, weight: w.attendance, hasData: false }
  return { score: Math.round(clamp100((att.present / scheduled) * 100)), weight: w.attendance, hasData: true }
}

function bandOf(score: number, t: EvalThresholds): EvalBand {
  if (score >= t.excellent) return 'excellent'
  if (score >= t.good) return 'good'
  if (score >= t.fair) return 'fair'
  return 'poor'
}

function buildNotes(b: EvalBreakdown, score: number): string {
  const part = (label: string, c: EvalCriterionResult) => c.hasData ? `${label}: ${c.score}/100 (peso ${c.weight})` : `${label}: sin datos`
  return [
    `Evaluación automática — score ${score}/100.`,
    part('Productividad', b.productivity),
    part('Calidad', b.quality),
    part('Puntualidad', b.punctuality),
    part('Asistencia', b.attendance),
  ].join(' · ')
}

/** Ventana del período. Housekeeping compara endTime ISO; attendance compara date 'YYYY-MM-DD'. */
function periodBounds(type: EvalPeriodType): { label: string; fromIso: string; toIso: string; fromDate: string; toDate: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-11
  let start: Date
  let label: string
  if (type === 'quarterly') {
    const quarter = Math.floor(month / 3)
    start = new Date(Date.UTC(year, quarter * 3, 1))
    label = `${year}-Q${quarter + 1}`
  } else {
    start = new Date(Date.UTC(year, month, 1))
    label = `${year}-${String(month + 1).padStart(2, '0')}`
  }
  const fromIso = start.toISOString()
  const toIso = now.toISOString()
  return { label, fromIso, toIso, fromDate: fromIso.slice(0, 10), toDate: toIso.slice(0, 10) }
}
