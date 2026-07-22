// Los 4 eventos que mueven el status de la suscripción SaaS. Se testea handleStripeEvent
// (ya con el evento verificado) — no processSubscriptionWebhook, que exige una firma HMAC
// real de Stripe y no aporta nada más sobre la lógica de negocio.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import type { RepositoryAdapter } from 'arckode-framework'
import { handleStripeEvent } from '../usecases/handle-stripe-event'

const CURRENT_PERIOD_END_UNIX = 1_800_000_000 // 2027-01-15T... (fecha fija arbitraria, solo importa que se propague)
const CURRENT_PERIOD_END_ISO = new Date(CURRENT_PERIOD_END_UNIX * 1000).toISOString()

function makeRepo(rows: any[]): { repo: RepositoryAdapter<any>; updates: Array<{ id: string; patch: any }> } {
  const updates: Array<{ id: string; patch: any }> = []
  const repo = {
    findMany: async (filter: Record<string, unknown>) =>
      rows.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
    findOne: async () => null,
    create: async (d: any) => d,
    update: async (id: string, patch: any) => { updates.push({ id, patch }); return { id, ...patch } },
    delete: async () => true,
    count: async () => rows.length,
    paginate: async () => ({ data: rows, total: rows.length, limit: 20, offset: 0, pages: 1 }),
  } as unknown as RepositoryAdapter<any>
  return { repo, updates }
}

// La API version 2025-08-27 mueve `current_period_end` de la Subscription al SubscriptionItem
// (ver handle-stripe-event.ts:currentPeriodEndOf) — el mock respeta esa forma real.
function fakeStripe(currentPeriodEnd = CURRENT_PERIOD_END_UNIX) {
  return {
    subscriptions: {
      retrieve: async (_id: string) => ({ items: { data: [{ current_period_end: currentPeriodEnd }] } }),
    },
  } as any
}

describe('handleStripeEvent — suscripción SaaS del hotel', () => {
  it('checkout.session.completed: activa la suscripción y guarda el ID de Stripe + currentPeriodEnd', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', planId: 'p1', status: 'trialing' }])
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_123',
          subscription: 'sub_stripe_1',
          metadata: { hotelId: 'h1', planId: 'p1' },
        },
      },
    } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.id).toBe('sub1')
    expect(updates[0]!.patch.status).toBe('active')
    expect(updates[0]!.patch.stripeSubscriptionId).toBe('sub_stripe_1')
    expect(updates[0]!.patch.stripeCustomerId).toBe('cus_123')
    expect(updates[0]!.patch.currentPeriodEnd).toBe(CURRENT_PERIOD_END_ISO)
  })

  it('checkout.session.completed: ignora sesiones que no son de suscripción (mode payment, otro flujo)', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'trialing' }])
    const event = { type: 'checkout.session.completed', data: { object: { mode: 'payment', metadata: {} } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(0)
  })

  it('invoice.paid: renueva currentPeriodEnd y reafirma active', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'past_due', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = {
      type: 'invoice.paid',
      data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } },
    } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.id).toBe('sub1')
    expect(updates[0]!.patch.status).toBe('active')
    expect(updates[0]!.patch.currentPeriodEnd).toBe(CURRENT_PERIOD_END_ISO)
  })

  it('invoice.payment_failed: pasa a past_due sin tocar otros campos', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = {
      type: 'invoice.payment_failed',
      data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } },
    } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toEqual([{ id: 'sub1', patch: { status: 'past_due' } }])
  })

  it('customer.subscription.deleted: cancela y sella canceledAt', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.patch.status).toBe('canceled')
    expect(typeof updates[0]!.patch.canceledAt).toBe('string')
  })

  it('evento no manejado: no explota ni toca el repo (200 OK igual, patrón estándar de webhooks)', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active' }])
    const event = { type: 'customer.updated', data: { object: {} } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(0)
  })

  it('checkout.session.completed sin Subscription local para el hotel: no explota, solo loguea', async () => {
    const { repo, updates } = makeRepo([])
    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', metadata: { hotelId: 'h-desconocido' } } },
    } as any

    await handleStripeEvent({ subscriptionsRepo: repo, logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(0)
  })
})
