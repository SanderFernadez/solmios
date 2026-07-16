// usecases/stats.ts — Estadísticas por empleado con agregación en memoria (D5).
// El ORM no expone GROUP BY → se filtra por hotelId+completed+rango y se agrega en memoria.
// Cache versionado (D6): la versión se incrementa en cada mutación del service.
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { HousekeepingDTO, StaffStats, StaffStatsQuery, HousekeepingUser } from '../types'
import type { HousekeepingStaffStat } from '../sockets'

/** Estados de una tarea ya terminada: 'completed' (limpieza hecha) e 'inspected' (además aprobada). */
const FINISHED_STATUSES = new Set(['completed', 'inspected'])

const STATS_CACHE_TTL = 300
const STATS_VERSION_TTL = 24 * 60 * 60 // 1 día en segundos
const DEFAULT_WINDOW_DAYS = 30

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export class StatsUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
  ) {}

  async stats(query: StaffStatsQuery, currentUser: HousekeepingUser): Promise<StaffStats[]> {
    let hotelId = currentUser.hotelId
    if (!hotelId && currentUser.role !== 'super_admin') {
      const user = await this.userRepo.findById(currentUser.id)
      hotelId = user?.hotelId
    }
    if (currentUser.role !== 'super_admin') {
      if (!hotelId) throw new AuthError('No hotel assigned')
    } else if (query.hotelId) {
      hotelId = query.hotelId
    }

    const from = query.from ?? daysAgoIso(DEFAULT_WINDOW_DAYS)
    const to = query.to ?? new Date().toISOString()

    const vKey = `housekeeping:stats:version:${hotelId ?? 'all'}`
    const version = ((await this.cache.get(vKey)) as number | undefined) ?? 0
    const cacheKey = `housekeeping:stats:${hotelId ?? 'all'}:${from}:${to}:v${version}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as StaffStats[]

    const tasks = await this.repo.findMany({ hotelId: hotelId!, status: 'completed' } as any)
    const inRange = tasks.filter(t => t.startTime && t.endTime && t.endTime >= from && t.endTime <= to)
    const byStaff = new Map<string, { count: number; totalMs: number }>()
    for (const t of inRange) {
      const key = t.staffId || 'unassigned'
      const ms = new Date(t.endTime!).getTime() - new Date(t.startTime!).getTime()
      const acc = byStaff.get(key) ?? { count: 0, totalMs: 0 }
      acc.count += 1
      acc.totalMs += ms
      byStaff.set(key, acc)
    }
    const result: StaffStats[] = [...byStaff.entries()].map(([staffId, v]) => ({
      staffId,
      completed: v.count,
      avgDurationMs: v.count > 0 ? Math.round(v.totalMs / v.count) : 0,
      totalDurationMs: v.totalMs,
    }))
    await this.cache.set(cacheKey, result, STATS_CACHE_TTL)
    return result
  }

  /**
   * Agregado por camarera para el motor de evaluación (#321): tareas terminadas, tiempo promedio
   * y promedio del rating del supervisor. Incluye 'inspected' (aprobadas) además de 'completed' —
   * al aprobar, la tarea deja de estar 'completed', y su tiempo/rating igual cuentan para el desempeño.
   */
  async aggregate(hotelId: string, from: string, to: string): Promise<HousekeepingStaffStat[]> {
    const all = await this.repo.findMany({ hotelId } as any)
    const finished = all.filter(
      (t) => t.status && FINISHED_STATUSES.has(t.status) && t.startTime && t.endTime && t.endTime >= from && t.endTime <= to,
    )
    const byStaff = new Map<string, { count: number; totalMs: number; ratingSum: number; ratingN: number }>()
    for (const t of finished) {
      const key = t.staffId || 'unassigned'
      const ms = new Date(t.endTime!).getTime() - new Date(t.startTime!).getTime()
      const acc = byStaff.get(key) ?? { count: 0, totalMs: 0, ratingSum: 0, ratingN: 0 }
      acc.count += 1
      acc.totalMs += ms
      if (typeof t.rating === 'number') { acc.ratingSum += t.rating; acc.ratingN += 1 }
      byStaff.set(key, acc)
    }
    return [...byStaff.entries()].map(([staffId, v]) => ({
      staffId,
      completed: v.count,
      avgDurationMs: v.count > 0 ? Math.round(v.totalMs / v.count) : 0,
      avgRating: v.ratingN > 0 ? v.ratingSum / v.ratingN : null,
    }))
  }

  /** Incrementa la versión de stats para un hotel → la próxima lectura recalcula (D6). */
  async bumpVersion(hotelId?: string): Promise<void> {
    const vKey = `housekeeping:stats:version:${hotelId ?? 'all'}`
    const cur = ((await this.cache.get(vKey)) as number | undefined) ?? 0
    await this.cache.set(vKey, cur + 1, STATS_VERSION_TTL)
  }
}
