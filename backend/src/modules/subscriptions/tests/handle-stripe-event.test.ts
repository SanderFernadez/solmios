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

/** hotels: fila mínima con `email`/`name` — usada por notifyPlatformEmail (findById). */
function makeHotelsRepo(rows: any[] = [{ id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }]): RepositoryAdapter<any> {
  return {
    findMany: async () => rows,
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
    findOne: async () => null,
    create: async (d: any) => d,
    update: async () => null,
    delete: async () => true,
    count: async () => rows.length,
    paginate: async () => ({ data: rows, total: rows.length, limit: 20, offset: 0, pages: 1 }),
  } as unknown as RepositoryAdapter<any>
}

/** ORM fake en memoria, mismo criterio que admin/tests/special-conditions.test.ts — usado
 *  solo por los tests de liberación de cupo en customer.subscription.deleted. */
function makeOrm(tables: Record<string, any[]>) {
  const store: Record<string, any[]> = { ...tables }
  const matches = (row: any, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([k, v]) => row[k] === v)
  return {
    store,
    findMany: async (table: string, filters: Record<string, unknown> = {}) =>
      (store[table] ?? []).filter((r) => matches(r, filters)),
    update: async (table: string, id: string, patch: any) => {
      const row = (store[table] ?? []).find((r) => r.id === id)
      if (row) Object.assign(row, patch)
      return row ?? null
    },
    updateMany: async (table: string, filters: Record<string, unknown>, changes: any) => {
      const rows = (store[table] ?? []).filter((r) => matches(r, filters))
      for (const row of rows) Object.assign(row, changes)
      return rows.length
    },
    create: async (table: string, data: any) => {
      const row = { id: data.id ?? `${table}-${(store[table]?.length ?? 0) + 1}`, ...data }
      store[table] = [...(store[table] ?? []), row]
      return row
    },
  }
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

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.id).toBe('sub1')
    expect(updates[0]!.patch.status).toBe('active')
    expect(updates[0]!.patch.stripeSubscriptionId).toBe('sub_stripe_1')
    expect(updates[0]!.patch.stripeCustomerId).toBe('cus_123')
    expect(updates[0]!.patch.currentPeriodEnd).toBe(CURRENT_PERIOD_END_ISO)
    // Checkout mode:'subscription' = tarjeta autorizada para auto-cobro (§536/538/539/540:
    // sin esto el cron nunca podía distinguir "pago recurrente" de "pago manual").
    expect(updates[0]!.patch.isRecurring).toBe(true)
  })

  it('checkout.session.completed: ignora sesiones que no son de suscripción (mode payment, otro flujo)', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'trialing' }])
    const event = { type: 'checkout.session.completed', data: { object: { mode: 'payment', metadata: {} } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(0)
  })

  it('invoice.paid: renueva currentPeriodEnd y reafirma active', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'past_due', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = {
      type: 'invoice.paid',
      data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } },
    } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)

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

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toEqual([{ id: 'sub1', patch: { status: 'past_due' } }])
  })

  it('customer.subscription.deleted: cancela y sella canceledAt', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.patch.status).toBe('canceled')
    expect(typeof updates[0]!.patch.canceledAt).toBe('string')
  })

  it('customer.subscription.deleted: un Fundador que cancela pierde la categoría, libera el cupo y queda en founder_history (§4/§9/#535)', async () => {
    const { repo, updates } = makeRepo([{
      id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1', specialCategory: 'founder_one',
    }])
    const orm = makeOrm({
      SpecialCategoryConfig: [{ id: 'cfg1', key: 'founder_one', totalSlots: 10, occupiedCount: 4, status: 'open' }],
      SubscriptionDiscounts: [{ id: 'd1', subscriptionId: 'sub1', type: 'category_bonus', discountPct: 40, status: 'active', endsAt: null }],
      FounderHistory: [],
    })
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), orm }, event)

    expect(updates[0]!.patch).toMatchObject({ status: 'canceled', specialCategory: null, specialCategoryGrantedAt: null })
    expect(orm.store.SpecialCategoryConfig[0]!.occupiedCount).toBe(3)
    expect(orm.store.FounderHistory).toHaveLength(1)
    expect(orm.store.FounderHistory[0]).toMatchObject({ hotelId: 'h1', category: 'founder_one', reason: 'canceled' })
    expect(orm.store.SubscriptionDiscounts[0]!.status).toBe('revoked')
  })

  it('customer.subscription.deleted: un Pionero que cancela libera el cupo pero NO deja founder_history (Pionero no tiene anti-recuperación)', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1', specialCategory: 'pioneer' }])
    const orm = makeOrm({
      SpecialCategoryConfig: [{ id: 'cfg3', key: 'pioneer', totalSlots: 75, occupiedCount: 6, status: 'open' }],
      SubscriptionDiscounts: [], FounderHistory: [],
    })
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), orm }, event)

    expect(orm.store.SpecialCategoryConfig[0]!.occupiedCount).toBe(5)
    expect(orm.store.FounderHistory).toHaveLength(0)
  })

  it('customer.subscription.deleted sin categoría especial: no toca SpecialCategoryConfig ni founder_history', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const orm = makeOrm({ SpecialCategoryConfig: [], FounderHistory: [] })
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), orm }, event)

    expect(orm.store.FounderHistory).toHaveLength(0)
  })

  it('evento no manejado: no explota ni toca el repo (200 OK igual, patrón estándar de webhooks)', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active' }])
    const event = { type: 'customer.updated', data: { object: {} } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(0)
  })

  it('checkout.session.completed sin Subscription local para el hotel: no explota, solo loguea', async () => {
    const { repo, updates } = makeRepo([])
    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', metadata: { hotelId: 'h-desconocido' } } },
    } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(0)
  })
})

describe('handleStripeEvent — correos de platform-emails (best-effort)', () => {
  it('invoice.paid: dispara payment_succeeded con el email/nombre del hotel', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'past_due', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'invoice.paid', data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } } } as any
    const calls: any[] = []
    const sendPlatformEmail = async (ev: string, to: string, hotelId: string, vars: Record<string, string>) => {
      calls.push({ ev, to, hotelId, vars })
      return { sent: true }
    }

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail }, event)

    // El sub arrancó `past_due` (bloqueado) — además de payment_succeeded, este pago lo
    // reactiva y dispara subscription_reactivated (handle-stripe-event.ts, patch de grace/suspend).
    expect(calls).toHaveLength(2)
    expect(calls[0].ev).toBe('payment_succeeded')
    expect(calls[0].to).toBe('dueno@hotel.com')
    expect(calls[0].hotelId).toBe('h1')
    expect(calls[0].vars.hotel_name).toBe('Hotel Sol')
    expect(calls[1].ev).toBe('subscription_reactivated')
  })

  it('invoice.paid sobre una suscripción `active` (nunca estuvo bloqueada): solo payment_succeeded, sin subscription_reactivated', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'invoice.paid', data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } } } as any
    const calls: any[] = []
    const sendPlatformEmail = async (ev: string, to: string, hotelId: string, vars: Record<string, string>) => {
      calls.push({ ev, to, hotelId, vars })
      return { sent: true }
    }

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail }, event)

    expect(calls).toHaveLength(1)
    expect(calls[0].ev).toBe('payment_succeeded')
  })

  it('invoice.paid sobre `suspended`: limpia graceEndsAt/suspendedAt/suspendedReason y reactiva', async () => {
    const { repo, updates } = makeRepo([{
      id: 'sub1', hotelId: 'h1', status: 'suspended', stripeSubscriptionId: 'sub_stripe_1',
      graceEndsAt: '2026-01-01T00:00:00.000Z', suspendedAt: '2026-01-06T00:00:00.000Z', suspendedReason: 'grace_period_expired',
    }])
    const event = { type: 'invoice.paid', data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)

    expect(updates[0]!.patch).toMatchObject({ status: 'active', graceEndsAt: null, suspendedAt: null, suspendedReason: null })
  })

  it('invoice.payment_failed: dispara payment_failed', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'invoice.payment_failed', data: { object: { parent: { subscription_details: { subscription: 'sub_stripe_1' } } } } } as any
    const calls: any[] = []
    const sendPlatformEmail = async (ev: string, to: string, hotelId: string, _vars: Record<string, string>) => {
      calls.push({ ev, to, hotelId })
      return { sent: true }
    }

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail }, event)

    expect(calls).toEqual([{ ev: 'payment_failed', to: 'dueno@hotel.com', hotelId: 'h1' }])
  })

  it('customer.subscription.deleted: dispara subscription_canceled', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any
    const calls: any[] = []
    const sendPlatformEmail = async (ev: string, to: string, hotelId: string, _vars: Record<string, string>) => {
      calls.push({ ev, to, hotelId })
      return { sent: true }
    }

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail }, event)

    expect(calls).toEqual([{ ev: 'subscription_canceled', to: 'dueno@hotel.com', hotelId: 'h1' }])
  })

  it('sin sendPlatformEmail inyectado: no explota (opcional)', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe() }, event)
    expect(updates).toHaveLength(1) // el webhook igual movió el status
  })

  it('hotel sin email: no llama a sendPlatformEmail', async () => {
    const { repo } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const calls: any[] = []
    const sendPlatformEmail = async (ev: string, to: string, hotelId: string, _vars: Record<string, string>) => {
      calls.push({ ev, to, hotelId }); return { sent: true }
    }
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any

    await handleStripeEvent(
      { subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo([{ id: 'h1', name: 'Hotel Sol' /* sin email */ }]), logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail },
      event,
    )
    expect(calls).toHaveLength(0)
  })

  it('sendPlatformEmail que explota NO rompe el handler: el status igual se actualiza', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any
    const sendPlatformEmail = async () => { throw new Error('SMTP caído') }

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: makeHotelsRepo(), logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.patch.status).toBe('canceled')
  })

  it('hotelsRepo.findById que explota NO rompe el handler', async () => {
    const { repo, updates } = makeRepo([{ id: 'sub1', hotelId: 'h1', status: 'active', stripeSubscriptionId: 'sub_stripe_1' }])
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_stripe_1' } } } as any
    const brokenHotelsRepo = { findById: async () => { throw new Error('DB caída') } } as unknown as RepositoryAdapter<any>
    const sendPlatformEmail = async () => ({ sent: true })

    await handleStripeEvent({ subscriptionsRepo: repo, hotelsRepo: brokenHotelsRepo, logger: silentLogger(), stripe: fakeStripe(), sendPlatformEmail }, event)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.patch.status).toBe('canceled')
  })
})
