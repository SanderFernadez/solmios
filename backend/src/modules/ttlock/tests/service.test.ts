import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { TtlockService } from '../service'
import { TtlockQueries } from '../usecases/ttlock-queries'

const log = silentLogger()

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'Configuration') return [{ id: 'cfg1', value: JSON.stringify({ clientId: 'test', clientSecret: 'sec', accessToken: 'tok', region: 'eu' }) }]
      if (table === 'LockDevices') return [{ id: 'l1', hotelId: 'h1', ttlockLockId: '123', name: 'Door 1', roomId: 'rm1', status: 'online' }]
      if (table === 'LockCodes') return [{ id: 'c1', lockId: 'l1', hotelId: 'h1', code: '1234', status: 'active' }]
      if (table === 'Rooms') return [{ id: 'rm1', number: '101' }]
      return []
    },
    findById: async (table: string, _id: string) => {
      if (table === 'Reservations') return { id: 'res1', hotelId: 'h1', roomId: 'rm1', checkIn: '2026-06-01', checkOut: '2026-06-03' }
      if (table === 'LockDevices') return { id: 'l1', hotelId: 'h1', name: 'Door 1', roomId: 'rm1' }
      if (table === 'LockCodes') return { id: 'c1', lockId: 'l1', hotelId: 'h1', code: '1234', status: 'active' }
      return null
    },
    create: async (_table: string, data: any) => data,
    update: async (_table: string, _id: string, _data: any) => {},
    delete: async (_table: string, _id: string) => {},
    ...overrides,
  }
}

function repo(orm: any, table: string) {
  return {
    findMany: async (filter: any) => orm.findMany(table, filter),
    findById: async (id: string) => orm.findById(table, id),
    findOne: async (filter: any) => { const rows = await orm.findMany(table, filter); return rows[0] || null },
    create: async (data: any) => orm.create(table, data),
    update: async (id: string, data: any) => orm.update(table, id, data),
    delete: async (id: string) => orm.delete(table, id),
    count: async (filter?: any) => { const rows = await orm.findMany(table, filter); return rows.length },
    paginate: async (filter?: any, _options?: any) => { const rows = await orm.findMany(table, filter); return { data: rows, total: rows.length, limit: 20, offset: 0, pages: 1 } },
  }
}

describe('TtlockService', () => {
  describe('getConfig', () => {
    it('returns connection status', async () => {
      const orm = makeOrm()
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      const result = await svc.getConfig('h1')
      expect(result.configured).toBe(true)
      expect(result.connected).toBe(true)
    })
  })

  describe('listLocks', () => {
    it('returns locks with room numbers', async () => {
      const orm = makeOrm()
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      const result = await svc.listLocks('h1')
      expect(result).toHaveLength(1)
      expect(result[0].roomNumber).toBe('101')
    })
  })

  describe('updateLock', () => {
    it('updates lock fields', async () => {
      let lockData = { id: 'l1', name: 'Door 1', roomId: 'rm1', hotelId: 'h1' }
      const orm = makeOrm({
        findById: async (table: string, _id: string) => {
          if (table === 'LockDevices') return lockData
          if (table === 'Reservations') return { id: 'res1', hotelId: 'h1', roomId: 'rm1', checkIn: '2026-06-01', checkOut: '2026-06-03' }
          return null
        },
        update: async (_table: string, _id: string, data: any) => { lockData = { ...lockData, ...data } },
      })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      const result = await svc.updateLock('l1', { name: 'Updated Door' })
      expect(result.name).toBe('Updated Door')
    })
  })

  describe('revokeCode', () => {
    it('marks code as revoked', async () => {
      let updated = false
      const orm = makeOrm({ update: async () => { updated = true } })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      await svc.revokeCode('c1', 'h1')
      expect(updated).toBe(true)
    })

    it('borra el PIN de la cerradura FÍSICA, no solo la fila', async () => {
      const calls: string[] = []
      const orm = makeOrm({
        findById: async (table: string, _id: string) => {
          if (table === 'LockCodes') return { id: 'c1', lockId: 'l1', hotelId: 'h1', code: '1234', status: 'active', ttlockKeyboardPwdId: '999' }
          if (table === 'LockDevices') return { id: 'l1', hotelId: 'h1', ttlockLockId: '123' }
          return null
        },
        update: async () => { calls.push('db-update') },
      })
      const realFetch = globalThis.fetch
      globalThis.fetch = (async (url: any, init: any) => {
        calls.push(`fetch:${String(url)}`)
        calls.push(`body:${String(init?.body)}`)
        return new Response(JSON.stringify({ errcode: 0 }))
      }) as any
      try {
        const queries = new TtlockQueries(orm)
        const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
        await svc.revokeCode('c1', 'h1')
      } finally {
        globalThis.fetch = realFetch
      }
      expect(calls.some(c => c.includes('/v3/keyboardPwd/delete'))).toBe(true)
      expect(calls.some(c => c.includes('keyboardPwdId=999'))).toBe(true)
      expect(calls).toContain('db-update')
    })

    it('NO marca revocado si la cerradura rechaza el borrado', async () => {
      let updated = false
      const orm = makeOrm({
        findById: async (table: string, _id: string) => {
          if (table === 'LockCodes') return { id: 'c1', lockId: 'l1', hotelId: 'h1', status: 'active', ttlockKeyboardPwdId: '999' }
          if (table === 'LockDevices') return { id: 'l1', hotelId: 'h1', ttlockLockId: '123' }
          return null
        },
        update: async () => { updated = true },
      })
      const realFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response(JSON.stringify({ errcode: 10003, errmsg: 'invalid token' }))) as any
      try {
        const queries = new TtlockQueries(orm)
        const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
        await expect(svc.revokeCode('c1', 'h1')).rejects.toThrow(/TTLock/)
      } finally {
        globalThis.fetch = realFetch
      }
      // Si el PIN sigue vivo en la puerta, la fila no puede decir "revocado".
      expect(updated).toBe(false)
    })
  })
})
