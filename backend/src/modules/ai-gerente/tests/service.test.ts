// ai-gerente/tests/service.test.ts — Tests de M17 Gerente IA (ask/list/feedback).
import { describe, it, expect } from 'bun:test'
import type { CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AiGerenteService } from '../service'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function mockRepo(overrides: Record<string, any> = {}): any {
  return {
    findMany: async () => [],
    findById: async () => null,
    create: async (d: any) => d,
    update: async (_id: string, d: any) => ({ ...d }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, pages: 0 }),
    ...overrides,
  }
}

const USER = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }

describe('AiGerenteService', () => {
  it('ask: agrega KPIs y devuelve una respuesta (fallback sin LLM)', async () => {
    const reservationRepo = mockRepo({ findMany: async () => [
      { id: 'r1', hotelId: 'h1', checkIn: '2026-06-26', checkOut: '2026-06-28', status: 'confirmed', totalAmount: 300, createdAt: '2026-06-01' },
      { id: 'r2', hotelId: 'h1', checkIn: '2026-06-20', checkOut: '2026-06-22', status: 'cancelled', totalAmount: 200, createdAt: '2026-06-15' },
    ] })
    const roomRepo = mockRepo({ findMany: async () => [{ id: 'rm1' }, { id: 'rm2' }, { id: 'rm3' }] })
    const hotelRepo = mockRepo({ findById: async () => ({ id: 'h1', name: 'Hotel Test' }) })
    const service = new AiGerenteService(mockRepo(), reservationRepo, roomRepo, hotelRepo, mockRepo(), mockRepo(), log, silentCache)

    const interaction = await service.ask('¿Cómo va la ocupación?', USER)
    expect(interaction).toBeDefined()
    expect(interaction.response).toBeTruthy()
    expect(interaction.hotelId).toBe('h1')
    expect(interaction.queryType).toBe('question')
  })

  it('ask: lanza si el user no tiene hotel asignado', async () => {
    const service = new AiGerenteService(mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), log, silentCache)
    await expect(service.ask('algo', { id: 'u', role: 'receptionist' } as any)).rejects.toThrow('No hotel assigned')
  })

  it('list: devuelve estructura paginada', async () => {
    const interactionRepo = mockRepo({ paginate: async () => ({ data: [{ id: 'i1' }], total: 1, pages: 1 }) })
    const service = new AiGerenteService(interactionRepo, mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), log, silentCache)
    const result = await service.list({ hotelId: 'h1', page: 1, limit: 10 })
    expect(result.data.length).toBe(1)
    expect(result.pagination.total).toBe(1)
  })

  it('feedback: delega al repo cuando el hotel coincide', async () => {
    const interactionRepo = mockRepo({
      findById: async () => ({ id: 'i1', hotelId: 'h1' }),
      update: async (_id: string, d: any) => ({ id: 'i1', ...d }),
    })
    const service = new AiGerenteService(interactionRepo, mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), log, silentCache)
    const updated = await service.feedback('i1', 'helpful', USER)
    expect(updated).toMatchObject({ feedback: 'helpful' })
  })

  it('feedback: null si la interacción no existe', async () => {
    const service = new AiGerenteService(mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), log, silentCache)
    const updated = await service.feedback('nope', 'helpful', USER)
    expect(updated).toBeNull()
  })

  it('feedback: IDOR — rechaza feedback de otro hotel', async () => {
    const interactionRepo = mockRepo({ findById: async () => ({ id: 'i1', hotelId: 'h2' }) })
    const service = new AiGerenteService(interactionRepo, mockRepo(), mockRepo(), mockRepo(), mockRepo(), mockRepo(), log, silentCache)
    await expect(service.feedback('i1', 'helpful', USER)).rejects.toThrow('No autorizado')
  })
})
