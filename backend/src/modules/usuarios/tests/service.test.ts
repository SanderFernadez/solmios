// usuarios/tests/service.test.ts — Tests del servicio (con RepositoryAdapter mock)
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth, Logger } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { UsuariosService } from '../service'

const log: Logger = silentLogger()
const cache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, clear: async () => {}, flush: async () => {} }
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (d: any) => ({ id: 'u1', ...d }), update: async (id: string, d: any) => ({ id, ...d }),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('UsuariosService', () => {
  it('login lanza si no existe el usuario', async () => {
    const svc = new UsuariosService(makeRepo(), log, cache, fakeAuth)
    await expect(svc.login('no@x.com', 'p')).rejects.toThrow()
  })

  it('me lanza NotFound si no existe', async () => {
    const svc = new UsuariosService(makeRepo(), log, cache, fakeAuth)
    await expect(svc.me('no-existe')).rejects.toThrow('Usuario no encontrado')
  })

  it('create hashea el password y retorna el usuario', async () => {
    const svc = new UsuariosService(makeRepo(), log, cache, fakeAuth)
    const u = await svc.create({ nombre: 'Ana', email: 'a@x.com', password: 'secreto', hotelId: 'h1' })
    expect(u.id).toBe('u1')
    expect(u.password).not.toBe('secreto')
  })

  it('delete retorna true', async () => {
    const svc = new UsuariosService(makeRepo(), log, cache, fakeAuth)
    expect(await svc.delete('x')).toBe(true)
  })
})
