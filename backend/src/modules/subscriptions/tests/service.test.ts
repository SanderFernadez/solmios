// Lo que el service agrega sobre los usecases: qué planes se muestran a quien
// todavía no es cliente, y qué ve el hotel sobre su propia suscripción.
import { describe, it, expect } from 'bun:test'
import { SubscriptionsService } from '../service'
import type { RepositoryAdapter, Logger } from 'arckode-framework'

const log = { info() {}, error() {}, warn() {}, child: () => log } as unknown as Logger

function repoOf(rows: any[]): RepositoryAdapter<any> {
  return {
    findMany: async (f: any = {}) => rows.filter(r => Object.entries(f).every(([k, v]) => r[k] === v)),
    findById: async (id: string) => rows.find(r => r.id === id) ?? null,
    create: async (r: any) => { rows.push(r); return r },
    update: async (id: string, patch: any) => {
      const r = rows.find(x => x.id === id)
      if (r) Object.assign(r, patch)
      return r
    },
  } as unknown as RepositoryAdapter<any>
}

const PLANS = [
  { id: 'p2', name: 'Pro', slug: 'pro', price: 99, currency: 'USD', description: 'x', features: ['a'], isActive: 1, sortOrder: 2, limits: { rooms: 30 }, modules: ['x'] },
  { id: 'p1', name: 'Starter', slug: 'starter', price: 49, currency: 'USD', description: 'y', features: [], isActive: 1, sortOrder: 1, limits: { rooms: 10 }, modules: [] },
  { id: 'p9', name: 'Viejo', slug: 'old', price: 10, currency: 'USD', isActive: 0, sortOrder: 0 },
]

function setup(subs: any[] = [], hotels: any[] = [{ id: 'h1', status: 'active' }]) {
  return new SubscriptionsService(
    repoOf(subs), repoOf(hotels), repoOf([]), repoOf([]), repoOf([...PLANS]), repoOf([]), undefined, log,
  )
}

describe('SubscriptionsService.publicPlans', () => {
  it('muestra solo los activos, ordenados', async () => {
    const plans = await setup().publicPlans()
    expect(plans.map(p => p.slug)).toEqual(['starter', 'pro'])
  })

  it('no filtra detalle interno del plan hacia afuera', async () => {
    const [plan] = await setup().publicPlans()
    // `limits` y `modules` son cómo se aplica el plan puertas adentro.
    expect(plan).not.toHaveProperty('limits')
    expect(plan).not.toHaveProperty('modules')
    expect(plan).toMatchObject({ name: 'Starter', price: 49 })
  })
})

describe('SubscriptionsService.statusOf', () => {
  it('en prueba: informa cuántos días quedan y que puede trabajar', async () => {
    const trialEndsAt = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const st = await setup([{ id: 's1', hotelId: 'h1', status: 'trialing', trialEndsAt }]).statusOf('h1')
    expect(st.allowed).toBe(true)
    expect(st.status).toBe('trialing')
    expect(st.daysLeft).toBeGreaterThan(0)
  })

  it('prueba vencida: no puede trabajar y dice por qué', async () => {
    const trialEndsAt = new Date(Date.now() - 86_400_000).toISOString()
    const st = await setup([{ id: 's1', hotelId: 'h1', status: 'trialing', trialEndsAt }]).statusOf('h1')
    expect(st.allowed).toBe(false)
    expect(st.reason).toBe('trial_expired')
  })

  it('hotel viejo sin suscripción: sigue trabajando', async () => {
    const st = await setup([]).statusOf('h1')
    expect(st.allowed).toBe(true)
    expect(st.status).toBe('none')
  })
})

describe('SubscriptionsService.signup', () => {
  it('crea la cuenta y devuelve cuándo termina la prueba', async () => {
    const svc = setup()
    const res = await svc.signup({
      hotelName: 'Hotel Nuevo', email: 'nuevo@ejemplo.com', password: 'Clave12345',
    })
    expect(res.hotelId).toBeTruthy()
    expect(res.userId).toBeTruthy()
    expect(new Date(res.trialEndsAt).getTime()).toBeGreaterThan(Date.now())
  })
})
