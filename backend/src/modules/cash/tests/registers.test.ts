// cash/tests/registers.test.ts — Separación por punto de venta (reception vs restaurant).
//
// Antes: un solo turno por hotel. El POS de restaurante cobraba en efectivo y ese ingreso caía
// en el MISMO turno que recepción — sin forma de distinguir qué cajero (mostrador o mesero) tenía
// cuánto efectivo encima, y el turno solo lo podía abrir/cerrar hotel_admin (requiresHotelAdmin en
// el front). Ahora cada `register` tiene su propio turno concurrente e independiente.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { CashService } from '../service'
import type { CashMovementDTO, CashShiftDTO, CurrentUser } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
const currentUser: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function makeRepo<T extends object>(ov: Partial<RepositoryAdapter<T>> = {}): RepositoryAdapter<T> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (d: any) => ({ id: 'x1', ...d } as T),
    update: async (id: any, d: any) => ({ id, ...d } as T),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...ov,
  } as RepositoryAdapter<T>
}
function makeUserRepo(hotelId = 'h1'): RepositoryAdapter<any> {
  return { ...makeRepo<any>(), findById: async () => ({ id: 'u1', hotelId }) }
}

describe('registers — reception y restaurant no comparten turno', () => {
  it('abrir turno de restaurant NO choca con un turno de reception ya abierto', async () => {
    // Simula: ya hay un turno 'reception' abierto. findMany filtra por register — si el mock
    // ignorara el filtro, esto fallaría (rechazaría el open de restaurant por error).
    const openShifts: any[] = [{ id: 's-recep', hotelId: 'h1', status: 'open', register: 'reception' }]
    const shiftRepo = makeRepo<CashShiftDTO>({
      findMany: async (f: any) => openShifts.filter((s) => s.register === f.register),
      create: async (d: any) => ({ id: 's-rest', ...d } as CashShiftDTO),
    })
    const s = new CashService(makeRepo<CashMovementDTO>(), shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    const shift = await s.openShift({ openingAmount: 50 }, currentUser, 'restaurant')
    expect(shift.status).toBe('open')
    expect(shift.register).toBe('restaurant')
  })

  it('abrir un SEGUNDO turno del MISMO register lo rechaza', async () => {
    const shiftRepo = makeRepo<CashShiftDTO>({
      findMany: async () => ([{ id: 's-rest', hotelId: 'h1', status: 'open', register: 'restaurant' }] as any),
    })
    const s = new CashService(makeRepo<CashMovementDTO>(), shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    await expect(s.openShift({ openingAmount: 20 }, currentUser, 'restaurant')).rejects.toThrow('Ya hay un turno')
  })

  it('closeShift rechaza cerrar un turno de OTRO register (escalación cross-register)', async () => {
    // Un mesero (permiso `restaurant`, ruta /api/caja/restaurant/*) pasa a mano el id de un turno
    // que en realidad es de recepción — no debe poder cerrarlo.
    const shift = { id: 's-recep', hotelId: 'h1', status: 'open', register: 'reception', openingAmount: 100 } as CashShiftDTO
    const shiftRepo = makeRepo<CashShiftDTO>({ findById: async () => shift })
    const s = new CashService(makeRepo<CashMovementDTO>(), shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    await expect(s.closeShift('s-recep', { countedAmount: 100 }, currentUser, 'restaurant'))
      .rejects.toThrow('otro punto de venta')
  })

  it('reconcile rechaza arquear un turno de OTRO register', async () => {
    const shift = { id: 's-rest', hotelId: 'h1', status: 'open', register: 'restaurant', openingAmount: 0 } as CashShiftDTO
    const shiftRepo = makeRepo<CashShiftDTO>({ findById: async () => shift })
    const s = new CashService(makeRepo<CashMovementDTO>(), shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    await expect(s.reconcile('s-rest', currentUser, 'reception')).rejects.toThrow('otro punto de venta')
  })

  it('closeShift SIN expectedRegister (ruta de recepción, comportamiento histórico) sigue funcionando', async () => {
    const shift = { id: 's1', hotelId: 'h1', status: 'open', register: 'reception', openingAmount: 100 } as CashShiftDTO
    const shiftRepo = makeRepo<CashShiftDTO>({
      findById: async () => shift,
      update: async (_id: any, d: any) => ({ ...shift, ...d } as CashShiftDTO),
    })
    const s = new CashService(makeRepo<CashMovementDTO>(), shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    const closed = await s.closeShift('s1', { countedAmount: 100 }, currentUser)
    expect(closed.status).toBe('closed')
  })

  it('un movimiento manual creado en la caja del restaurante queda tageado register=restaurant', async () => {
    const created: any[] = []
    const repo = makeRepo<CashMovementDTO>({
      create: async (d: any) => { created.push(d); return { id: 'm1', ...d } as CashMovementDTO },
    })
    const shiftRepo = makeRepo<CashShiftDTO>({ findMany: async () => ([{ id: 's-rest', register: 'restaurant', status: 'open' }] as any) })
    const s = new CashService(repo, shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    await s.create({ type: 'expense', amount: 15, concept: 'Hielo' } as any, currentUser, 'restaurant')
    expect(created[0].register).toBe('restaurant')
    expect(created[0].shiftId).toBe('s-rest')
  })

  it('getById/update/delete de un movimiento de OTRO register da NotFound (sin leak entre cajas)', async () => {
    const mov = { id: 'm1', hotelId: 'h1', register: 'reception', source: 'manual' } as CashMovementDTO
    const repo = makeRepo<CashMovementDTO>({ findById: async () => mov })
    const s = new CashService(repo, makeRepo<CashShiftDTO>(), makeUserRepo(), log, silentCache, passAuth)
    await expect(s.getById('m1', currentUser, 'restaurant')).rejects.toThrow('Movimiento no encontrado')
    await expect(s.update('m1', { amount: 5 } as any, currentUser, 'restaurant')).rejects.toThrow('Movimiento no encontrado')
    await expect(s.delete('m1', currentUser, 'restaurant')).rejects.toThrow('Movimiento no encontrado')
  })

  it('registerPaymentIncome con register=restaurant asienta en la caja del restaurante, no en la de recepción', async () => {
    const created: any[] = []
    const shiftCalls: any[] = []
    const repo = makeRepo<CashMovementDTO>({
      findMany: async () => [],
      create: async (d: any) => { created.push(d); return { id: 'm1', ...d } as CashMovementDTO },
    })
    const shiftRepo = makeRepo<CashShiftDTO>({
      findMany: async (f: any) => { shiftCalls.push(f); return (f.register === 'restaurant' ? [{ id: 's-rest', register: 'restaurant' }] : []) as any },
    })
    const s = new CashService(repo, shiftRepo, makeUserRepo(), log, silentCache, passAuth)
    await s.registerPaymentIncome({ hotelId: 'h1', paymentId: 'p-rest', amount: 25, register: 'restaurant' })
    expect(created[0].register).toBe('restaurant')
    expect(created[0].shiftId).toBe('s-rest')
  })

  it('registerPaymentIncome SIN register (folios/reservas, comportamiento histórico) cae en reception', async () => {
    const created: any[] = []
    const repo = makeRepo<CashMovementDTO>({
      findMany: async () => [],
      create: async (d: any) => { created.push(d); return { id: 'm2', ...d } as CashMovementDTO },
    })
    const s = new CashService(repo, makeRepo<CashShiftDTO>(), makeUserRepo(), log, silentCache, passAuth)
    await s.registerPaymentIncome({ hotelId: 'h1', paymentId: 'p-recep', amount: 60 })
    expect(created[0].register).toBe('reception')
  })

  // QA-ALTO encontrado en vivo (Playwright, no solo tests): la ruta de recepción llama
  // list()/stats()/closeShift()/reconcile() SIN pasar register — antes eso significaba "sin
  // filtrar" y el "Hoy" de recepción sumaba una propina cargada desde la caja del restaurante.
  // Ahora "sin register" default a 'reception', no "todo".
  describe('fix: "sin register" = reception, NO "sin filtrar" (leak real encontrado en vivo)', () => {
    it('list() de recepción (sin register) NO trae movimientos del restaurante', async () => {
      const all = [
        { id: 'm1', hotelId: 'h1', register: 'reception', amount: 10 },
        { id: 'm2', hotelId: 'h1', register: 'restaurant', amount: 35 },
      ] as any
      const repo = makeRepo<CashMovementDTO>({
        paginate: async (filters: any) => {
          const data = all.filter((m: any) => Object.entries(filters).every(([k, v]) => (m as any)[k] === v))
          return { data, total: data.length, limit: 20, offset: 0, pages: 1 }
        },
      })
      const s = new CashService(repo, makeRepo<CashShiftDTO>(), makeUserRepo(), log, silentCache, passAuth)
      const result = await s.list({}, currentUser) // sin register — como llama la ruta de recepción
      expect(result.data.map((m) => m.id)).toEqual(['m1'])
    })

    it('stats() de recepción (sin register) NO suma movimientos del restaurante', async () => {
      const repo = makeRepo<CashMovementDTO>({
        findMany: async (f: any) => ([
          { id: 'm1', type: 'income', amount: 10, method: 'cash', register: 'reception', createdAt: new Date().toISOString() },
          { id: 'm2', type: 'income', amount: 35, method: 'cash', register: 'restaurant', createdAt: new Date().toISOString() },
        ] as any).filter((m: any) => m.register === f.register),
      })
      const s = new CashService(repo, makeRepo<CashShiftDTO>(), makeUserRepo(), log, silentCache, passAuth)
      const stats = await s.stats(undefined, currentUser) // sin register — como llama la ruta de recepción
      expect(stats.today).toBe(10) // NO 45
    })

    it('closeShift/reconcile de recepción (sin expectedRegister) rechaza un turno que en realidad es de restaurant', async () => {
      const shift = { id: 's-rest', hotelId: 'h1', status: 'open', register: 'restaurant', openingAmount: 0 } as CashShiftDTO
      const shiftRepo = makeRepo<CashShiftDTO>({ findById: async () => shift })
      const s = new CashService(makeRepo<CashMovementDTO>(), shiftRepo, makeUserRepo(), log, silentCache, passAuth)
      // Llamada tal cual la hace /api/caja/shifts/:id/close (sin expectedRegister) con un id de otro cajón.
      await expect(s.closeShift('s-rest', { countedAmount: 0 }, currentUser)).rejects.toThrow('otro punto de venta')
      await expect(s.reconcile('s-rest', currentUser)).rejects.toThrow('otro punto de venta')
    })
  })

  // QA-ALTO encontrado por revisión adversarial: cash/index.ts gatea TODAS las rutas
  // /api/caja/restaurant/* (incluida la lectura) con 'restaurant:create', a propósito — es el
  // único permiso que waiter/receptionist/hotel_admin tienen y `kitchen` NO. `kitchen` sí tiene
  // 'restaurant:view'/'restaurant:edit' (para el KDS), así que gatear con esos hubiera dejado a
  // cocina abrir/cerrar/editar el cajón del restaurante — no le corresponde, no maneja plata.
  describe('kitchen no puede tocar la caja del restaurante (index.ts gatea con restaurant:create)', () => {
    it('kitchen NO tiene restaurant:create — motivo por el que index.ts elige ese permiso para gatear la caja', async () => {
      const { DEFAULT_ROLE_PERMISSIONS, hasPermission } = await import('../../../shared/permissions')
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.kitchen, 'restaurant', 'create')).toBe(false)
      // Sí tiene view/edit (KDS) — por eso NO se puede gatear la caja con esos dos.
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.kitchen, 'restaurant', 'view')).toBe(true)
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.kitchen, 'restaurant', 'edit')).toBe(true)
    })

    it('waiter/receptionist/hotel_admin sí tienen restaurant:create — mantienen acceso a su caja', async () => {
      const { DEFAULT_ROLE_PERMISSIONS, hasPermission } = await import('../../../shared/permissions')
      for (const role of ['waiter', 'receptionist', 'hotel_admin']) {
        expect(hasPermission(DEFAULT_ROLE_PERMISSIONS[role], 'restaurant', 'create')).toBe(true)
      }
    })
  })
})
