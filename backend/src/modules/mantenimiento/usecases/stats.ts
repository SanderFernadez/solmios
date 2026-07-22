// mantenimiento/usecases/stats.ts — Estadísticas del módulo
import type { RepositoryAdapter } from 'arckode-framework'
import type { MantenimientoDTO } from '../types'

const MS_PER_HOUR = 3_600_000

/** Productividad de mantenimiento por técnico (staffId = users.id = assignedTo). Lo consume el motor
 *  de evaluación #321 vía el connector empleados-mantenimiento. */
export interface MaintStaffStat {
  staffId: string
  resolved: number
  avgResolutionMs: number
}

export class StatsUseCase {
  constructor(private readonly repo: RepositoryAdapter<MantenimientoDTO>) {}

  /** Tickets resueltos/cerrados por técnico dentro del período [from,to] (por día). avgResolutionMs
   *  sale de startTime→endTime (mismo criterio que getStats). Solo tickets con assignedTo interno. */
  async getStaffStats(hotelId: string, from: string, to: string): Promise<MaintStaffStat[]> {
    const all = await this.repo.findMany({ hotelId }) as MantenimientoDTO[]
    const fromDay = from.slice(0, 10)
    const toDay = to.slice(0, 10)
    const byTech = new Map<string, { resolved: number; durMs: number; durCount: number }>()
    for (const o of all) {
      if ((o.status !== 'closed' && o.status !== 'resolved') || !o.assignedTo) continue
      const when = String(o.resolvedDate || o.endTime || '').slice(0, 10)
      if (!when || when < fromDay || when > toDay) continue
      const acc = byTech.get(o.assignedTo) ?? { resolved: 0, durMs: 0, durCount: 0 }
      acc.resolved++
      if (o.startTime && o.endTime) {
        acc.durMs += new Date(o.endTime).getTime() - new Date(o.startTime).getTime()
        acc.durCount++
      }
      byTech.set(o.assignedTo, acc)
    }
    return [...byTech.entries()].map(([staffId, a]) => ({
      staffId, resolved: a.resolved, avgResolutionMs: a.durCount > 0 ? a.durMs / a.durCount : 0,
    }))
  }

  async getStats(hotelId: string) {
    const all = await this.repo.findMany({ hotelId }) as MantenimientoDTO[]
    const closed = all.filter(o => o.status === 'closed' || o.status === 'resolved')
    const withDuration = closed.filter(o => o.startTime && o.endTime)
    let avgResolutionHours = 0
    if (withDuration.length > 0) {
      const totalMs = withDuration.reduce((sum, o) => sum + (new Date(o.endTime!).getTime() - new Date(o.startTime!).getTime()), 0)
      avgResolutionHours = Math.round((totalMs / withDuration.length) / MS_PER_HOUR * 10) / 10
    }
    return {
      total: all.length,
      open: all.filter(o => o.status === 'open').length,
      inProgress: all.filter(o => o.status === 'in_progress').length,
      waiting: all.filter(o => o.status === 'waiting').length,
      closed: closed.length,
      avgResolutionHours,
      totalCost: all.reduce((sum, o) => sum + (o.estimatedCost || 0), 0),
      unassigned: all.filter(o => !o.assignedTo && o.status !== 'closed').length,
    }
  }
}
