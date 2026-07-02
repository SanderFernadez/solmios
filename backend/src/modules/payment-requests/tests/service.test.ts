// payment-requests/tests/service.ts — Tests del servicio.
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Stripe real.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PaymentRequestsService } from '../service'
import type { PaymentRequestDTO, CurrentUser } from '../types'

const log = silentLogger()
const currentUser: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

// Auth que SÍ valida ownership: throw si el recurso no es del hotel del user (y no es super_admin).
const strictAuth: Auth = {
  assertOwnership: (resourceHotelId: string, userHotelId: string, role: string, adminRole: string) => {
    if (role === adminRole) return
    if (resourceHotelId !== userHotelId) throw new Error('Forbidden: sin ownership')
  },
  authenticate: (() => []) as any,
} as unknown as Auth

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

function makeService(opts: { userHotelId?: string; auth?: Auth; prHotelId?: string } = {}) {
  const prHotelId = opts.prHotelId ?? 'h1'
  const pr: PaymentRequestDTO = {
    id: 'pr1', hotelId: prHotelId, reservationId: 'r1', amount: 100,
    currency: 'USD', status: 'pending', sentTo: 'guest@x.com', sentVia: 'email',
  }
  const repo = makeRepo<PaymentRequestDTO>({ findById: async () => pr })
  const auth = opts.auth ?? strictAuth
  const userRepo = makeUserRepo(opts.userHotelId ?? 'h1')
  return new PaymentRequestsService(
    repo, makeRepo<any>(), makeRepo<any>(), makeRepo<any>(), userRepo, log, auth,
  )
}

describe('PaymentRequestsService', () => {
  it('list filtra por hotelId del JWT', async () => {
    let captured: any = null
    const repo = makeRepo<PaymentRequestDTO>({ findMany: async (f: any) => { captured = f; return [] } })
    const s = new PaymentRequestsService(repo, makeRepo<any>(), makeRepo<any>(), makeRepo<any>(), makeUserRepo(), log, strictAuth)
    await s.list({ reservationId: 'r1' }, currentUser)
    expect(captured.hotelId).toBe('h1')
    expect(captured.reservationId).toBe('r1')
  })

  it('create fuerza hotelId del JWT (P0 IDOR)', async () => {
    const created: any[] = []
    const repo = makeRepo<PaymentRequestDTO>({ create: async (d: any) => { created.push(d); return { id: 'pr1', ...d } } })
    const s = new PaymentRequestsService(repo, makeRepo<any>(), makeRepo<any>(), makeRepo<any>(), makeUserRepo(), log, strictAuth)
    // Intento IDOR: body pide hotelId='h2', user es 'h1'.
    await s.create({ reservationId: 'r1', amount: 100, hotelId: 'h2' } as any, currentUser)
    expect(created[0].hotelId).toBe('h1') // forzado al del JWT
    expect(created[0].status).toBe('pending')
  })

  it('getById lanza NotFound si no existe', async () => {
    const s = makeService()
    // forzar findById null
    const s2 = new PaymentRequestsService(
      makeRepo<PaymentRequestDTO>({ findById: async () => null }),
      makeRepo<any>(), makeRepo<any>(), makeRepo<any>(), makeUserRepo(), log, strictAuth,
    )
    await expect(s2.getById('no-existe', currentUser)).rejects.toThrow('Payment request no encontrado')
    void s
  })

  it('update bloquea IDOR: PR de otro hotel → Forbidden (CR-26)', async () => {
    // PR pertenece a 'h2', user es 'h1' → assertOwnership debe throw.
    const s = makeService({ prHotelId: 'h2', userHotelId: 'h1' })
    await expect(s.update('pr1', { status: 'paid' }, currentUser)).rejects.toThrow('Forbidden')
  })

  it('update permite PR del propio hotel', async () => {
    const s = makeService({ prHotelId: 'h1', userHotelId: 'h1' })
    const updated = await s.update('pr1', { status: 'paid' }, currentUser)
    expect(updated.status).toBe('paid')
  })

  it('delete bloquea IDOR: PR de otro hotel → Forbidden (CR-25)', async () => {
    const s = makeService({ prHotelId: 'h2', userHotelId: 'h1' })
    await expect(s.delete('pr1', currentUser)).rejects.toThrow('Forbidden')
  })

  it('stripeStatus retorna configured:false sin keys', async () => {
    const s = makeService()
    const status = await s.stripeStatus(currentUser)
    expect(status.configured).toBe(false)
  })

  it('createCheckout retorna 503 si Stripe no configurado', async () => {
    const s = makeService()
    const res = await s.createCheckout('pr1', currentUser, 'http://localhost') as any
    expect(res.status).toBe(503)
  })
})
