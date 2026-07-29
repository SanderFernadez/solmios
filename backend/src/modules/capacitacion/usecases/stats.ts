// capacitacion/usecases/stats.ts — Estadísticas del módulo (DT-19).
import type { RepositoryAdapter } from 'arckode-framework'
import type { EnrollmentDTO } from '../types'

/** Cursos completados por empleado (employeeId = EmployeeProfile.id, misma clave que attendance).
 *  Lo consume el motor de evaluación #321 vía el connector empleados-capacitacion. */
export interface TrainingStaffStat {
  employeeId: string
  completed: number
  /** Promedio de `score` (0-100) SOLO entre las inscripciones completadas que tienen nota cargada
   *  (es opcional al completar un curso). `null` si ninguna trae nota — el motor de evaluación lo
   *  trata como "sin data" para ese criterio, igual que un rating de housekeeping ausente. */
  avgScore: number | null
}

export class StatsUseCase {
  constructor(private readonly repo: RepositoryAdapter<EnrollmentDTO>) {}

  /** Inscripciones completadas por empleado dentro del período [from,to] (por día, sobre completedAt). */
  async getStaffStats(hotelId: string, from: string, to: string): Promise<TrainingStaffStat[]> {
    const all = await this.repo.findMany({ hotelId }) as EnrollmentDTO[]
    const fromDay = from.slice(0, 10)
    const toDay = to.slice(0, 10)
    const byEmployee = new Map<string, { completed: number; scoreSum: number; scoreCount: number }>()
    for (const e of all) {
      if (e.status !== 'completed' || !e.employeeId) continue
      const when = String(e.completedAt || '').slice(0, 10)
      if (!when || when < fromDay || when > toDay) continue
      const acc = byEmployee.get(e.employeeId) ?? { completed: 0, scoreSum: 0, scoreCount: 0 }
      acc.completed++
      if (e.score != null) { acc.scoreSum += e.score; acc.scoreCount++ }
      byEmployee.set(e.employeeId, acc)
    }
    return [...byEmployee.entries()].map(([employeeId, a]) => ({
      employeeId, completed: a.completed,
      avgScore: a.scoreCount > 0 ? a.scoreSum / a.scoreCount : null,
    }))
  }
}
