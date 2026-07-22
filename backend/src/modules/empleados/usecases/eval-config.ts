// empleados/usecases/eval-config.ts — Config de reglas y tiempos del motor de evaluación (#322).
//
// Un registro por hotel (tabla performance_eval_config). get() siembra el default la 1ª vez.
// weights/thresholds son objetos JSON (el ORM los (de)serializa). findOne({hotelId}) scoped → sin IDOR.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type {
  PerformanceEvalConfigDTO, UpdatePerformanceEvalConfigDTO,
  EvalWeights, EvalThresholds, EvalPeriodType,
} from '../types'

const DEFAULT_WEIGHTS: EvalWeights = { productivity: 30, quality: 35, punctuality: 20, attendance: 15 }
const DEFAULT_THRESHOLDS: EvalThresholds = { excellent: 90, good: 75, fair: 60 }
const DEFAULT_STANDARD_TASK_MINUTES = 30
const DEFAULT_STANDARD_RESOLUTION_HOURS = 24
const WEIGHT_KEYS: (keyof EvalWeights)[] = ['productivity', 'quality', 'punctuality', 'attendance']
const VALID_PERIODS: EvalPeriodType[] = ['monthly', 'quarterly']

export class EvalConfigUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<PerformanceEvalConfigDTO>,
    private readonly logger: Logger,
  ) {}

  /** Config del hotel; siembra el default la primera vez. */
  async get(hotelId: string): Promise<PerformanceEvalConfigDTO> {
    const existing = await this.repo.findOne({ hotelId })
    if (existing) return existing
    return this.repo.create({
      hotelId,
      period: 'monthly',
      weights: DEFAULT_WEIGHTS,
      thresholds: DEFAULT_THRESHOLDS,
      standardTaskMinutes: DEFAULT_STANDARD_TASK_MINUTES,
      standardResolutionHours: DEFAULT_STANDARD_RESOLUTION_HOURS,
      enabled: 1,
    } as any)
  }

  async update(hotelId: string, patch: UpdatePerformanceEvalConfigDTO): Promise<PerformanceEvalConfigDTO> {
    const current = await this.get(hotelId)
    const next: Record<string, unknown> = {}

    if (patch.period !== undefined) {
      if (!VALID_PERIODS.includes(patch.period)) throw new ValidationError(`period debe ser uno de: ${VALID_PERIODS.join(', ')}`)
      next.period = patch.period
    }
    if (patch.weights !== undefined) {
      this.assertWeights(patch.weights)
      next.weights = patch.weights
    }
    if (patch.thresholds !== undefined) {
      this.assertThresholds(patch.thresholds)
      next.thresholds = patch.thresholds
    }
    if (patch.standardTaskMinutes !== undefined) {
      if (!(patch.standardTaskMinutes > 0)) throw new ValidationError('standardTaskMinutes debe ser mayor que 0')
      next.standardTaskMinutes = patch.standardTaskMinutes
    }
    if (patch.standardResolutionHours !== undefined) {
      if (!(patch.standardResolutionHours > 0)) throw new ValidationError('standardResolutionHours debe ser mayor que 0')
      next.standardResolutionHours = patch.standardResolutionHours
    }
    if (patch.enabled !== undefined) next.enabled = patch.enabled ? 1 : 0

    return this.repo.update(current.id, next as any) as Promise<PerformanceEvalConfigDTO>
  }

  private assertWeights(w: EvalWeights): void {
    let sum = 0
    for (const k of WEIGHT_KEYS) {
      const v = w[k]
      if (typeof v !== 'number' || v < 0) throw new ValidationError(`weights.${k} debe ser un número >= 0`)
      sum += v
    }
    if (sum !== 100) throw new ValidationError(`Los pesos deben sumar 100 (suman ${sum})`)
  }

  private assertThresholds(t: EvalThresholds): void {
    const { excellent, good, fair } = t
    for (const [k, v] of [['excellent', excellent], ['good', good], ['fair', fair]] as const) {
      if (typeof v !== 'number' || v < 0 || v > 100) throw new ValidationError(`thresholds.${k} debe estar entre 0 y 100`)
    }
    if (!(excellent > good && good > fair)) throw new ValidationError('Los umbrales deben ser descendentes: excellent > good > fair')
  }
}
