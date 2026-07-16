// attendance/tests/manual-record.test.ts — Validación de negocio del fichaje manual (alimenta nómina)
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AttendanceService } from '../service'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

// profileRepo que confirma que e1 pertenece a h1 (fichaje válido)
const profileOfHotel = makeRepo({ findOne: async (f: any) => (f?.id === 'e1' && f?.hotelId === 'h1' ? { id: 'e1', hotelId: 'h1' } : null) })

function makeService(profileRepo: RepositoryAdapter<any> = profileOfHotel) {
  return new AttendanceService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, makeRepo(), profileRepo)
}

describe('AttendanceService.manualRecord — validación de negocio', () => {
  it('rechaza salida anterior o igual a la entrada', async () => {
    const svc = makeService()
    await expect(svc.manualRecord('e1', 'h1', { clockIn: '2026-01-01T10:00:00Z', clockOut: '2026-01-01T08:00:00Z' }, 'sup'))
      .rejects.toThrow('posterior a la entrada')
  })

  it('rechaza un registro que supera 24 horas', async () => {
    const svc = makeService()
    await expect(svc.manualRecord('e1', 'h1', { clockIn: '2026-01-01T08:00:00Z', clockOut: '2026-01-03T08:00:00Z' }, 'sup'))
      .rejects.toThrow('24 horas')
  })

  it('rechaza un empleado que no pertenece al hotel', async () => {
    const svc = makeService(makeRepo({ findOne: async () => null }))
    await expect(svc.manualRecord('intruso', 'h1', { clockIn: '2026-01-01T08:00:00Z', clockOut: '2026-01-01T16:00:00Z' }, 'sup'))
      .rejects.toThrow('no pertenece a este hotel')
  })

  it('rechaza clockIn con fecha inválida', async () => {
    const svc = makeService()
    await expect(svc.manualRecord('e1', 'h1', { clockIn: 'no-es-fecha', clockOut: '2026-01-01T16:00:00Z' }, 'sup'))
      .rejects.toThrow('clockIn inválido')
  })

  it('acepta un fichaje manual válido y calcula las horas', async () => {
    const svc = makeService()
    const r = await svc.manualRecord('e1', 'h1', { clockIn: '2026-01-01T08:00:00Z', clockOut: '2026-01-01T16:00:00Z' }, 'sup') as any
    expect(r.totalHours).toBe(8)
  })
})
