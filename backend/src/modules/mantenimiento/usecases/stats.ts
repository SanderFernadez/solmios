// mantenimiento/usecases/stats.ts — Estadísticas del módulo
import type { RepositoryAdapter } from 'arckode-framework'
import type { MantenimientoDTO } from '../types'

const MS_PER_HOUR = 3_600_000

export class StatsUseCase {
  constructor(private readonly repo: RepositoryAdapter<MantenimientoDTO>) {}

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
