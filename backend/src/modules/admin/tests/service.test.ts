import { describe, it, expect, afterEach } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { AdminService } from '../service'
import { DashboardQueries } from '../usecases/dashboard-queries'

const log = silentLogger()

function makeRepos(overrides = {}) {
  const repo = (data: any[]) => ({
    findMany: async (_filter: any) => data,
    findById: async (id: string) => data.find((d: any) => d.id === id) || null,
    findOne: async (_filter: any) => data[0] || null,
    create: async (d: any) => d,
    update: async (_id: string, _d: any) => ({ id: _id, ...data[0], ..._d }),
    delete: async (_id: string) => true,
    count: async () => data.length,
    paginate: async (_filter?: any, _options?: any) => ({ data, total: data.length, limit: 20, offset: 0, pages: 1 }),
    ...overrides,
  })
  return {
    plansRepo: repo([{ id: 'p1', name: 'Essential', price: 49 }]),
    amenitiesRepo: repo([{ id: 'a1', key: 'wifi', label: 'WiFi' }]),
  }
}

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'Hotels') return [{ id: 'h1', name: 'Hotel 1', plan: 'professional', status: 'active' }]
      if (table === 'Users') return [{ id: 'u1', name: 'User 1', email: 'user@test.com' }]
      if (table === 'Reservations') return [{ id: 'r1', totalAmount: 100 }]
      if (table === 'Announcements') return []
      if (table === 'Auditlog') return []
      if (table === 'Tickets') return []
      return []
    },
    findById: async (_table: string, _id: string) => null,
    count: async (_table: string) => 0,
    create: async (_table: string, data: any) => data,
    update: async (_table: string, _id: string, _data: any) => {},
    delete: async (_table: string, _id: string) => {},
    ...overrides,
  }
}

describe('AdminService', () => {
  describe('listHotels', () => {
    it('returns hotels list', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      const result = await svc.listHotels()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('listUsers', () => {
    it('returns users list without passwords', async () => {
      const repos = makeRepos()
      const orm = makeOrm({
        findMany: async () => [{ id: 'u1', name: 'User', password: 'secret' }],
      })
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(orm))
      const result = await svc.listUsers()
      expect(result.data[0]).not.toHaveProperty('password')
    })
  })

  describe('getAnalytics', () => {
    it('returns analytics with counts', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      const result = await svc.getAnalytics()
      expect(result.totalHoteles).toBe(1)
      expect(result.totalUsuarios).toBe(1)
      expect(result.totalReservas).toBe(1)
    })
  })

  describe('listPlans', () => {
    it('returns plans list', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      const result = await svc.listPlans()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createPlan', () => {
    it('creates a new plan', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      const result = await svc.createPlan({ name: 'New Plan', price: 99 })
      expect(result.name).toBe('New Plan')
      expect(result.price).toBe(99)
    })

    it('throws without name', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      await expect(svc.createPlan({ price: 99 })).rejects.toThrow('name y price requeridos')
    })
  })

  describe('deletePlan', () => {
    it('deletes existing plan', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      await expect(svc.deletePlan('p1')).resolves.toBeUndefined()
    })

    it('throws for non-existent plan', async () => {
      const repos = makeRepos()
      const svc = new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(makeOrm()))
      await expect(svc.deletePlan('nope')).rejects.toThrow('no encontrado')
    })
  })

  describe('getPublicUsers — fail-closed SEC-3.1 (V6)', () => {
    const demoOrm = makeOrm({
      findMany: async (table: string) => {
        if (table === 'Users') return [{ id: 'u1', name: 'Demo', email: 'demo@solmios.com', role: 'hotel_admin', isDemo: 1, active: 1 }]
        return []
      },
    })
    const prevNodeEnv = process.env.NODE_ENV
    const prevDemo = process.env.DEMO_LOGIN

    const makeSvc = () => {
      const repos = makeRepos()
      return new AdminService(repos.plansRepo, repos.amenitiesRepo, log, undefined, new DashboardQueries(demoOrm))
    }

    afterEach(() => {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevNodeEnv
      if (prevDemo === undefined) delete process.env.DEMO_LOGIN
      else process.env.DEMO_LOGIN = prevDemo
    })

    it('devuelve [] si NODE_ENV no esta seteado (fail-closed: deploy sin NODE_ENV no filtra cuentas demo)', async () => {
      delete process.env.NODE_ENV
      delete process.env.DEMO_LOGIN
      expect(await makeSvc().getPublicUsers()).toEqual([])
    })

    it('en dev (NODE_ENV=development) lista las cuentas demo, sin id ni credenciales', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.DEMO_LOGIN
      const result = await makeSvc().getPublicUsers()
      expect(result).toEqual([{ name: 'Demo', email: 'demo@solmios.com', role: 'hotel_admin' }])
      expect(result[0]).not.toHaveProperty('id')
    })

    it('en production solo lista si DEMO_LOGIN=1', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.DEMO_LOGIN
      expect(await makeSvc().getPublicUsers()).toEqual([])
      process.env.DEMO_LOGIN = '1'
      expect(await makeSvc().getPublicUsers()).toHaveLength(1)
    })
  })
})
