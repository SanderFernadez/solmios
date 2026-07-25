// subscription-suspension-cron.test.ts — recordatorio → gracia → suspensión + liberación de
// cupo Fundador. Mismo molde que trial-reminder-cron.test.ts (hermano), pero con un fake ORM
// que sí filtra por campo (findMany/updateMany del cron dependen de eso: llama findMany con
// distintos status en cada paso y espera que el ORM ya le devuelva solo lo que matchea).
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { createSubscriptionSuspensionCron } from '../subscription-suspension-cron'

const NOW = new Date('2026-07-20T00:00:00.000Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000
const isoDaysFromNow = (days: number) => new Date(NOW.getTime() + days * MS_PER_DAY).toISOString()

/** Fake ORM en memoria, exact-match por campo (mismo semántica que buildWhere del kernel real). */
function makeOrm(tables: Record<string, any[]>) {
  const store: Record<string, any[]> = { ...tables }
  const updates: Array<{ table: string; id: string; patch: any }> = []
  const creates: Array<{ table: string; data: any }> = []

  function matches(row: any, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([k, v]) => row[k] === v)
  }

  const orm = {
    findMany: async (table: string, filters: Record<string, unknown> = {}) =>
      (store[table] ?? []).filter((r) => matches(r, filters)),
    findById: async (table: string, id: string) => (store[table] ?? []).find((r) => r.id === id) ?? null,
    update: async (table: string, id: string, patch: any) => {
      updates.push({ table, id, patch })
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
      creates.push({ table, data })
      const row = { id: data.id ?? `${table}-${(store[table]?.length ?? 0) + 1}`, ...data }
      store[table] = [...(store[table] ?? []), row]
      return row
    },
  }
  return { orm, store, updates, creates }
}

function makeResolveModule(sendEvent: (...args: any[]) => Promise<{ sent: boolean }>) {
  return (name: string) => (name === 'platform-emails' ? { sendEvent } : null)
}

const HOTEL = { id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }

describe('createSubscriptionSuspensionCron', () => {
  it('active a reminderDaysBefore días del vencimiento: manda recordatorio y marca renewalReminderSentAt', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active', currentPeriodEnd: isoDaysFromNow(5), isRecurring: true }
    const { orm, updates } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const calls: any[] = []
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)

    expect(result).toEqual({ reminded: 1, pastDue: 0, suspended: 0 })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('subscription_renewal_auto')
    expect(updates.find((u) => u.patch.renewalReminderSentAt)).toBeTruthy()
  })

  it('recordatorio manual (isRecurring:false) manda subscription_renewal_manual', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active', currentPeriodEnd: isoDaysFromNow(5), isRecurring: false }
    const { orm } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const calls: any[] = []
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    await cron(NOW)
    expect(calls[0][0]).toBe('subscription_renewal_manual')
  })

  it('ya tiene renewalReminderSentAt: no reenvía (dedup)', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active', currentPeriodEnd: isoDaysFromNow(5), renewalReminderSentAt: '2026-07-19T00:00:00.000Z' }
    const { orm } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const calls: any[] = []
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)
    expect(result.reminded).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('active vencido: pasa a past_due con graceEndsAt = ahora + gracePeriodDays', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active', currentPeriodEnd: isoDaysFromNow(-1) }
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())

    const result = await cron(NOW)

    expect(result.pastDue).toBe(1)
    const updated = store.Subscriptions.find((s) => s.id === 'sub1')
    expect(updated.status).toBe('past_due')
    expect(new Date(updated.graceEndsAt).toISOString()).toBe(isoDaysFromNow(5)) // default gracePeriodDays=5
  })

  it('past_due con gracia agotada: suspende y avisa', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'past_due', graceEndsAt: isoDaysFromNow(-1) }
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const calls: any[] = []
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)

    expect(result.suspended).toBe(1)
    const updated = store.Subscriptions.find((s) => s.id === 'sub1')
    expect(updated.status).toBe('suspended')
    expect(updated.suspendedReason).toBe('grace_period_expired')
    expect(calls.find((c) => c[0] === 'subscription_suspended')).toBeTruthy()
  })

  it('past_due con gracia vigente: no suspende todavía', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'past_due', graceEndsAt: isoDaysFromNow(1) }
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())

    const result = await cron(NOW)
    expect(result.suspended).toBe(0)
    expect(store.Subscriptions.find((s) => s.id === 'sub1').status).toBe('past_due')
  })

  it('past_due sin graceEndsAt (seteado directo por Stripe payment_failed): lo calcula antes de evaluar suspensión', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'past_due' } // sin graceEndsAt todavía
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [] })
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())

    const result = await cron(NOW)
    expect(result.suspended).toBe(0) // gracia recién calculada, todavía no vencida
    const updated = store.Subscriptions.find((s) => s.id === 'sub1')
    expect(updated.graceEndsAt).toBeTruthy()
  })

  it('suspensión de un hotel Fundador: libera el cupo, deja rastro anti-recuperación y revoca el discount', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'past_due', graceEndsAt: isoDaysFromNow(-1), specialCategory: 'founder_one' }
    const config = { id: 'cfg1', key: 'founder_one', totalSlots: 10, occupiedCount: 3, status: 'open' }
    const discount = { id: 'd1', hotelId: 'h1', subscriptionId: 'sub1', type: 'category_bonus', discountPct: 40, status: 'active', endsAt: null }
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], SpecialCategoryConfig: [config], FounderHistory: [], Configuration: [], SubscriptionDiscounts: [discount] })
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())

    await cron(NOW)

    expect(store.SpecialCategoryConfig.find((c) => c.key === 'founder_one').occupiedCount).toBe(2)
    expect(store.FounderHistory).toHaveLength(1)
    expect(store.FounderHistory[0].hotelId).toBe('h1')
    expect(store.FounderHistory[0].reason).toBe('delinquent')
    expect(store.Subscriptions.find((s) => s.id === 'sub1').specialCategory).toBeNull()
    // QA manual: sin esto el discount quedaba 'active' aunque el hotel perdió la categoría por mora.
    expect(store.SubscriptionDiscounts.find((d) => d.id === 'd1').status).toBe('revoked')
  })

  it('suspensión de un hotel Pionero: NO libera cupo ni genera founder_history (solo Fundador tiene esa restricción)', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'past_due', graceEndsAt: isoDaysFromNow(-1), specialCategory: 'pioneer' }
    const config = { id: 'cfg1', key: 'pioneer', totalSlots: 75, occupiedCount: 10, status: 'open' }
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], SpecialCategoryConfig: [config], FounderHistory: [], Configuration: [] })
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())

    await cron(NOW)

    expect(store.SpecialCategoryConfig.find((c) => c.key === 'pioneer').occupiedCount).toBe(10)
    expect(store.FounderHistory).toHaveLength(0)
    expect(store.Subscriptions.find((s) => s.id === 'sub1').specialCategory).toBe('pioneer')
  })

  it('usa reminderDaysBefore/gracePeriodDays de Configuration en vez del default', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active', currentPeriodEnd: isoDaysFromNow(-1) }
    const settings = { id: 'cfg', hotelId: 'platform', key: 'subscription_settings', value: { reminderDaysBefore: 3, gracePeriodDays: 2 } }
    const { orm, store } = makeOrm({ Subscriptions: [sub], Hotels: [HOTEL], Configuration: [settings] })
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())

    await cron(NOW)
    const updated = store.Subscriptions.find((s) => s.id === 'sub1')
    expect(new Date(updated.graceEndsAt).toISOString()).toBe(isoDaysFromNow(2))
  })

  it('un error inesperado no rompe el cron (try/catch general)', async () => {
    const orm = {
      findMany: async () => { throw new Error('DB caída') },
      findById: async () => null,
      update: async () => null,
      updateMany: async () => 0,
      create: async () => ({}),
    }
    const cron = createSubscriptionSuspensionCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())
    const result = await cron(NOW)
    expect(result).toEqual({ reminded: 0, pastDue: 0, suspended: 0 })
  })
})
