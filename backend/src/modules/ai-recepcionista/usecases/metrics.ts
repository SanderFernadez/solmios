import type { AiMetricsDTO } from '../types'

/** Lists daily metrics for a hotel, newest first. (Behavior-parity with the original inline impl.) */
export async function getMetrics(repo: any, hotelId: string): Promise<AiMetricsDTO[]> {
  return repo.findMany({ hotelId }, { orderBy: { field: 'date', dir: 'desc' } })
}

/** Aggregates dashboard counters: active / transferred / waiting conversations + today's metrics. */
export async function getDashboardMetrics(
  conversationRepo: any,
  metricsRepo: any,
  hotelId: string,
): Promise<Record<string, unknown>> {
  const [active, assigned, waiting, todayMetrics] = await Promise.all([
    conversationRepo.count({ hotelId, status: 'active' }),
    conversationRepo.count({ hotelId, status: 'transferred' }),
    conversationRepo.count({ hotelId, status: 'waiting' }),
    metricsRepo.findMany({ hotelId, date: new Date().toISOString().split('T')[0] }),
  ])
  return {
    activeConversations: active,
    transferredConversations: assigned,
    waitingConversations: waiting,
    todayMetrics: todayMetrics[0] || null,
  }
}
