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

  // SEC-5.3 (#351): un merchant NO puede generar el código de puerta de una reserva de OTRO hotel.
  // El guard está en generateCodeForReservation: `if (res.hotelId !== hotelId) throw 'Sin acceso'`,
  // que corta ANTES de tocar la cerradura (por eso no hace falta mockear el cliente TTLock).
  describe('generateCode — aislamiento multi-tenant (SEC-5.3)', () => {
    it('un merchant NO genera código de una reserva de otro hotel', async () => {
      // findReservationById usa orm.findMany('Reservations', {id}); la reserva es del hotel 'h1'.
      const orm = makeOrm({
        findMany: async (table: string) => table === 'Reservations'
          ? [{ id: 'res1', hotelId: 'h1', roomId: 'rm1', checkIn: '2026-06-01', checkOut: '2026-06-03' }]
          : [],
      })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      // token del hotel 'h2' intentando generar el PIN de la reserva del hotel 'h1'
      await expect(svc.generateCode('h2', 'res1')).rejects.toThrow(/Sin acceso/)
    })

    it('rechaza si la reserva no existe', async () => {
      const orm = makeOrm() // findMany('Reservations') → [] → null → 'Reserva no encontrada'
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      await expect(svc.generateCode('h1', 'inexistente')).rejects.toThrow(/no encontrada/)
    })
  })

  // generateCodeIfAbsent — punto de entrada de la generación AUTOMÁTICA (al pagarse la seña). Debe
  // ser idempotente: el webhook de Stripe reintenta y una reserva puede tener varios Links de Pago.
  describe('generateCodeIfAbsent — idempotencia', () => {
    it('NO regenera si la reserva ya tiene un código ACTIVO', async () => {
      const orm = makeOrm({
        findMany: async (table: string) => table === 'LockCodes'
          ? [{ id: 'c1', reservationId: 'res1', hotelId: 'h1', status: 'active' }]
          : [],
      })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      const r = await svc.generateCodeIfAbsent('h1', 'res1')
      expect(r.skipped).toBe(true)
    })

    it('SÍ genera si el único código de la reserva está revocado (no activo)', async () => {
      // Sin código activo → NO saltea → llama a generateCode. La reserva no existe en este mock, así
      // que tira 'no encontrada': la excepción PRUEBA que pasó la guarda de idempotencia y siguió.
      const orm = makeOrm({
        findMany: async (table: string) => table === 'LockCodes'
          ? [{ id: 'c1', reservationId: 'res1', hotelId: 'h1', status: 'revoked' }]
          : [],
      })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      await expect(svc.generateCodeIfAbsent('h1', 'res1')).rejects.toThrow(/no encontrada/)
    })

    // #240 — código duplicado: con un código ACTIVO existente NO debe crearse una segunda fila.
    it('NO crea una segunda fila lock_codes si ya hay una activa', async () => {
      const created: any[] = []
      const orm = makeOrm({
        findMany: async (table: string) => table === 'LockCodes'
          ? [{ id: 'c1', reservationId: 'res1', hotelId: 'h1', status: 'active' }]
          : [],
        create: async (table: string, data: any) => { created.push({ table, ...data }); return data },
      })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      const r = await svc.generateCodeIfAbsent('h1', 'res1')
      expect(r.skipped).toBe(true)
      expect(created.filter((c) => c.table === 'LockCodes')).toHaveLength(0) // no duplica
    })

    // #240 — un código 'pending' (emitido con la cerradura offline) también bloquea la regeneración.
    it('NO regenera si la reserva ya tiene un código PENDING', async () => {
      const created: any[] = []
      const orm = makeOrm({
        findMany: async (table: string) => table === 'LockCodes'
          ? [{ id: 'c1', reservationId: 'res1', hotelId: 'h1', status: 'pending' }]
          : [],
        create: async (table: string, data: any) => { created.push({ table, ...data }); return data },
      })
      const queries = new TtlockQueries(orm)
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
      const r = await svc.generateCodeIfAbsent('h1', 'res1')
      expect(r.skipped).toBe(true)
      expect(r.reason).toBe('already-pending')
      expect(created.filter((c) => c.table === 'LockCodes')).toHaveLength(0)
    })
  })

  // #240 — cerradura OFFLINE: no se empuja el PIN al hardware, se registra el código como 'pending'.
  describe('generateCode — cerradura offline', () => {
    it('registra el código como pending y NO llama a la API de Sciener', async () => {
      const created: any[] = []
      const orm = makeOrm({
        findMany: async (table: string) => {
          if (table === 'Reservations') return [{ id: 'res1', hotelId: 'h1', roomId: 'rm1', checkIn: '2026-06-01', checkOut: '2026-06-03' }]
          // La cerradura de la habitación está OFFLINE.
          if (table === 'LockDevices') return [{ id: 'l1', hotelId: 'h1', ttlockLockId: '123', roomId: 'rm1', status: 'offline' }]
          if (table === 'Configuration') return [{ id: 'cfg1', value: JSON.stringify({ clientId: 'test', accessToken: 'tok', region: 'eu' }) }]
          return []
        },
        create: async (table: string, data: any) => { created.push({ table, ...data }); return data },
      })
      let fetchCalls = 0
      const realFetch = globalThis.fetch
      globalThis.fetch = (async () => { fetchCalls++; return new Response(JSON.stringify({ errcode: 0, keyboardPwdId: 1 })) }) as any
      try {
        const queries = new TtlockQueries(orm)
        const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
        const result = await svc.generateCode('h1', 'res1')
        // Side-effects: fila 'pending', sin PIN físico, y CERO llamadas a la cerradura.
        expect(fetchCalls).toBe(0)
        const lc = created.find((c) => c.table === 'LockCodes')
        expect(lc).toBeDefined()
        expect(lc.status).toBe('pending')
        expect(lc.ttlockKeyboardPwdId).toBe('')
        expect(lc.code).toBeTruthy()          // PIN pre-asignado para reintentar
        expect(lc.reservationId).toBe('res1')
        expect(result.status).toBe('pending')
      } finally {
        globalThis.fetch = realFetch
      }
    })
  })

  // QA-03 (#302): happy-path de generateCode — genera el PIN en la cerradura y persiste la fila
  // lock_codes ACTIVA con la ventana de la estadía. Se mockea el cliente Sciener (fetch).
  describe('generateCode — happy path', () => {
    it('crea la fila lock_codes activa con la ventana de la estadía y el PIN de la cerradura', async () => {
      const created: any[] = []
      const orm = makeOrm({
        findMany: async (table: string) => {
          if (table === 'Reservations') return [{ id: 'res1', hotelId: 'h1', roomId: 'rm1', checkIn: '2026-06-01', checkOut: '2026-06-03' }]
          if (table === 'LockDevices') return [{ id: 'l1', hotelId: 'h1', ttlockLockId: '123', roomId: 'rm1', status: 'online' }]
          if (table === 'Configuration') return [{ id: 'cfg1', value: JSON.stringify({ clientId: 'test', clientSecret: 'sec', accessToken: 'tok', region: 'eu' }) }]
          return []
        },
        create: async (table: string, data: any) => { created.push({ table, ...data }); return data },
      })
      const realFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response(JSON.stringify({ errcode: 0, keyboardPwdId: 555 }))) as any
      try {
        const queries = new TtlockQueries(orm)
        const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
        await svc.generateCode('h1', 'res1')
        const lc = created.find((c) => c.table === 'LockCodes')
        expect(lc).toBeDefined()
        expect(lc.status).toBe('active')
        expect(lc.reservationId).toBe('res1')
        expect(lc.startDate).toBe('2026-06-01')
        expect(lc.endDate).toBe('2026-06-03')
        expect(lc.code).toBeTruthy() // se generó un PIN
        expect(String(lc.ttlockKeyboardPwdId)).toBe('555') // pwdId devuelto por la cerradura
      } finally {
        globalThis.fetch = realFetch
      }
    })
  })

  // Fase B: gateways + códigos activos leídos del hardware (no de la BD).
  describe('listGateways / listActiveCodes', () => {
    it('listGateways devuelve los gateways de la cuenta TTLock', async () => {
      const orm = makeOrm()
      const realFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response(JSON.stringify({ total: 1, list: [{ gatewayId: 2312994, gatewayName: 'gateway', isOnline: 1, lockNum: 1 }] }))) as any
      try {
        const queries = new TtlockQueries(orm)
        const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries)
        const gws = await svc.listGateways('h1')
        expect(gws).toHaveLength(1)
        expect(gws[0].gatewayId).toBe(2312994)
        expect(gws[0].isOnline).toBe(1)
      } finally {
        globalThis.fetch = realFetch
      }
    })

    it('listActiveCodes lee los PIN reales del hardware de la cerradura', async () => {
      const orm = makeOrm({
        findById: async (table: string) => table === 'LockDevices' ? { id: 'l1', hotelId: 'h1', ttlockLockId: '123' } : null,
      })
      const realFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response(JSON.stringify({ total: 1, list: [{ keyboardPwdId: 1, keyboardPwd: '445566', nickName: 'Solmi', keyboardPwdType: 3, status: 1 }] }))) as any
      try {
        const queries = new TtlockQueries(orm)
        const auth = { assertOwnership: () => {} } as any
        const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries, auth)
        const codes = await svc.listActiveCodes('h1', 'l1')
        expect(codes).toHaveLength(1)
        expect(codes[0].keyboardPwd).toBe('445566')
        expect(codes[0].keyboardPwdName).toBe('Solmi') // mapea nickName → keyboardPwdName
      } finally {
        globalThis.fetch = realFetch
      }
    })

    it('listActiveCodes de una cerradura de OTRO hotel: assertOwnership corta', async () => {
      const orm = makeOrm({
        findById: async (table: string) => table === 'LockDevices' ? { id: 'l1', hotelId: 'h1', ttlockLockId: '123' } : null,
      })
      const queries = new TtlockQueries(orm)
      const auth = { assertOwnership: (a: string, b: string) => { if (a !== b) throw new Error('Forbidden') } } as any
      const svc = new TtlockService(repo(orm, 'LockDevices'), repo(orm, 'LockCodes'), log, queries, auth)
      await expect(svc.listActiveCodes('h2', 'l1')).rejects.toThrow(/Forbidden/)
    })
  })
})
