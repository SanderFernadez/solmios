import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/Dashboard.service', () => ({
  DashboardService: {
    stats: vi.fn(),
  },
}))

import { useDashboardStore } from './dashboard.store'
import { DashboardService } from '@/services/Dashboard.service'

const makeStats = (over: Record<string, unknown> = {}) =>
  ({
    occupancy: 75, arrivalsToday: 3, departuresToday: 2, pendingClean: 1, openIncidents: 0,
    revenueToday: 500, revenueMTD: 9000, avgRate: 120, revpar: 90,
    totalRooms: 20, occupied: 15, roomsByType: {}, roomsByStatus: {},
    reservations: 10, guests: 8, pendingInvoices: 0, ...over,
  } as any)

describe('dashboard.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('arranca con stats en cero y occupancyPct 0', () => {
    const store = useDashboardStore()
    expect(store.stats.occupancy).toBe(0)
    expect(store.stats.totalRooms).toBe(0)
    expect(store.occupancyPct).toBe(0)
    expect(store.loading).toBe(false)
  })

  it('fetchStats happy path carga stats y actualiza el computed occupancyPct', async () => {
    vi.mocked(DashboardService.stats).mockResolvedValue(makeStats({ occupancy: 82 }))
    const store = useDashboardStore()

    await store.fetchStats('h1')

    expect(DashboardService.stats).toHaveBeenCalledWith('h1')
    expect(store.stats.occupancy).toBe(82)
    expect(store.occupancyPct).toBe(82)
    expect(store.stats.revenueMTD).toBe(9000)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchStats sin hotelId lo pasa como undefined al service', async () => {
    vi.mocked(DashboardService.stats).mockResolvedValue(makeStats())
    const store = useDashboardStore()

    await store.fetchStats()

    expect(DashboardService.stats).toHaveBeenCalledWith(undefined)
  })

  it('fetchStats en error setea mensaje y NO pisa las stats previas', async () => {
    const store = useDashboardStore()
    // primero una carga OK
    vi.mocked(DashboardService.stats).mockResolvedValueOnce(makeStats({ occupancy: 60 }))
    await store.fetchStats('h1')
    // luego falla
    vi.mocked(DashboardService.stats).mockRejectedValueOnce(new Error('timeout'))

    await store.fetchStats('h1')

    expect(store.error).toBe('timeout')
    // edge case: las stats viejas se conservan (no se resetean en el catch)
    expect(store.stats.occupancy).toBe(60)
    expect(store.loading).toBe(false)
  })

  it('fetchStats con error no-Error usa mensaje por defecto', async () => {
    vi.mocked(DashboardService.stats).mockRejectedValue({ weird: true })
    const store = useDashboardStore()

    await store.fetchStats()

    expect(store.error).toBe('Error al cargar dashboard')
  })
})
