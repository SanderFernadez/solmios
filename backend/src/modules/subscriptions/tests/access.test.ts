// Esta es la regla que corta el servicio. Los casos que importan son los bordes:
// el trial que venció hace un minuto, el hotel viejo sin suscripción (que NO se
// puede quedar afuera por una migración) y el hotel suspendido a mano.
import { describe, it, expect } from 'bun:test'
import { SubscriptionAccess } from '../usecases/access'
import type { RepositoryAdapter } from 'arckode-framework'

const NOW = new Date('2026-07-19T12:00:00Z')
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

function setup(sub: any | null, hotel: any = { id: 'h1', status: 'active' }) {
  const updates: any[] = []
  const subscriptionsRepo = {
    findMany: async () => (sub ? [sub] : []),
    update: async (id: string, patch: any) => { updates.push({ id, ...patch }); return patch },
  } as unknown as RepositoryAdapter<any>
  const hotelsRepo = { findById: async () => hotel } as unknown as RepositoryAdapter<any>
  return { access: new SubscriptionAccess(subscriptionsRepo, hotelsRepo), updates }
}

describe('SubscriptionAccess — quién puede trabajar', () => {
  it('en prueba, con días por delante: entra y sabe cuántos le quedan', async () => {
    const { access } = setup({ id: 's1', status: 'trialing', trialEndsAt: inDays(3) })
    const r = await access.check('h1', NOW)
    expect(r.allowed).toBe(true)
    expect(r.daysLeft).toBe(3)
  })

  it('el último día todavía entra', async () => {
    const { access } = setup({ id: 's1', status: 'trialing', trialEndsAt: inDays(0.5) })
    expect((await access.check('h1', NOW)).allowed).toBe(true)
  })

  it('prueba vencida: se bloquea y se deja asentado', async () => {
    const { access, updates } = setup({ id: 's1', status: 'trialing', trialEndsAt: inDays(-0.001) })
    const r = await access.check('h1', NOW)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('trial_expired')
    expect(updates).toEqual([{ id: 's1', status: 'expired' }])
  })

  it('paga y está al día: entra', async () => {
    const { access } = setup({ id: 's1', status: 'active', currentPeriodEnd: inDays(20) })
    expect((await access.check('h1', NOW)).allowed).toBe(true)
  })

  it('período pago vencido: se bloquea', async () => {
    const { access } = setup({ id: 's1', status: 'active', currentPeriodEnd: inDays(-1) })
    const r = await access.check('h1', NOW)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('subscription_expired')
  })

  it('cancelada: se bloquea', async () => {
    const { access } = setup({ id: 's1', status: 'canceled' })
    const r = await access.check('h1', NOW)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('subscription_expired')
  })

  it('un cobro fallido todavía NO corta (hay margen para reintentar)', async () => {
    const { access } = setup({ id: 's1', status: 'past_due', currentPeriodEnd: inDays(5) })
    expect((await access.check('h1', NOW)).allowed).toBe(true)
  })

  it('hotel suspendido a mano: no entra, aunque la suscripción esté al día', async () => {
    const { access } = setup(
      { id: 's1', status: 'active', currentPeriodEnd: inDays(30) },
      { id: 'h1', status: 'suspended' },
    )
    const r = await access.check('h1', NOW)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('hotel_suspended')
  })

  it('los hoteles que ya existían (sin suscripción) siguen trabajando', async () => {
    const { access } = setup(null)
    expect((await access.check('h1', NOW)).allowed).toBe(true)
  })

  it('la plataforma nunca se bloquea a sí misma', async () => {
    const { access } = setup({ id: 's1', status: 'expired' })
    expect((await access.check('platform', NOW)).allowed).toBe(true)
  })

  it('sin hotel (super admin) tampoco se bloquea', async () => {
    const { access } = setup({ id: 's1', status: 'expired' })
    expect((await access.check('', NOW)).allowed).toBe(true)
  })
})
