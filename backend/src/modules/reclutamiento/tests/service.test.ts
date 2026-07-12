// reclutamiento/tests/service.test.ts — Tests del servicio (RepositoryAdapter mock).

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { ReclutamientoService } from '../service'
import type { ApplicantDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<ApplicantDTO>> = {}): RepositoryAdapter<ApplicantDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as ApplicantDTO),
    update: async (id, data) => ({ id, ...data } as ApplicantDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('ReclutamientoService', () => {
  it('getById lanza NotFound si no existe', async () => {
    const service = new ReclutamientoService(makeRepo(), log, silentCache)
    await expect(service.getById('no-existe')).rejects.toThrow('Postulante no encontrado')
  })

  it('create nace en etapa "new"', async () => {
    const service = new ReclutamientoService(makeRepo(), log, silentCache)
    const r = await service.create({ hotelId: 'h1', name: 'Ana' })
    expect(r.stage).toBe('new')
  })

  it('moveStage rechaza etapas inválidas', async () => {
    const item = { id: '1', hotelId: 'h1', stage: 'new' } as ApplicantDTO
    const service = new ReclutamientoService(makeRepo({ findById: async () => item }), log, silentCache)
    await expect(service.moveStage('1', 'no-existe')).rejects.toThrow('Etapa inválida')
  })

  it('hire no permite recontratar a un ya contratado', async () => {
    const item = { id: '1', hotelId: 'h1', stage: 'hired' } as ApplicantDTO
    const service = new ReclutamientoService(makeRepo({ findById: async () => item }), log, silentCache)
    await expect(service.hire('1', undefined)).rejects.toThrow('ya fue contratado')
  })

  it('pipeline devuelve un conteo por cada etapa', async () => {
    const service = new ReclutamientoService(makeRepo(), log, silentCache)
    const summary = await service.pipeline('h1')
    expect(summary.length).toBe(6)
  })
})
