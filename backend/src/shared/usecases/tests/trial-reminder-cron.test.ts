// trial-reminder-cron.test.ts — dedup por *SentAt + cálculo de daysLeft con fecha inyectada.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { createTrialReminderCron } from '../trial-reminder-cron'

const NOW = new Date('2026-07-20T00:00:00.000Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000
const isoDaysFromNow = (days: number) => new Date(NOW.getTime() + days * MS_PER_DAY).toISOString()

function makeOrm(subs: any[], hotels: any[]) {
  const updates: Array<{ table: string; id: string; patch: any }> = []
  const orm = {
    findMany: async (table: string, _filter: Record<string, unknown>) => (table === 'Subscriptions' ? subs : []),
    findById: async (table: string, id: string) => (table === 'Hotels' ? hotels.find((h) => h.id === id) ?? null : null),
    update: async (table: string, id: string, patch: any) => {
      updates.push({ table, id, patch })
      const row = (table === 'Subscriptions' ? subs : []).find((r: any) => r.id === id)
      if (row) Object.assign(row, patch)
      return row ?? null
    },
  }
  return { orm, updates }
}

function makeResolveModule(sendEvent: (...args: any[]) => Promise<{ sent: boolean }>) {
  return (name: string) => (name === 'platform-emails' ? { sendEvent } : null)
}

describe('createTrialReminderCron', () => {
  it('a 2 días de vencer sin trialReminderSentAt: manda trial_ending y marca la fecha', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(2) }]
    const hotels = [{ id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }]
    const { orm, updates } = makeOrm(subs, hotels)
    const calls: any[] = []
    const cron = createTrialReminderCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)

    expect(result).toEqual({ ending: 1, expired: 0 })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('trial_ending')
    expect(calls[0][1]).toBe('dueno@hotel.com')
    expect(calls[0][3].days_left).toBe('2')
    expect(updates).toHaveLength(1)
    expect(updates[0]!.patch.trialReminderSentAt).toBe(NOW.toISOString())
  })

  it('ya tiene trialReminderSentAt: no reenvía (dedup)', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(1), trialReminderSentAt: '2026-07-19T00:00:00.000Z' }]
    const hotels = [{ id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }]
    const { orm, updates } = makeOrm(subs, hotels)
    const calls: any[] = []
    const cron = createTrialReminderCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)

    expect(result).toEqual({ ending: 0, expired: 0 })
    expect(calls).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('trial vencido sin trialExpiredEmailSentAt: manda trial_expired y marca la fecha', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(-3) }]
    const hotels = [{ id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }]
    const { orm, updates } = makeOrm(subs, hotels)
    const calls: any[] = []
    const cron = createTrialReminderCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)

    expect(result).toEqual({ ending: 0, expired: 1 })
    expect(calls[0][0]).toBe('trial_expired')
    expect(updates[0]!.patch.trialExpiredEmailSentAt).toBe(NOW.toISOString())
  })

  it('ya tiene trialExpiredEmailSentAt: no reenvía (dedup)', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(-3), trialExpiredEmailSentAt: '2026-07-18T00:00:00.000Z' }]
    const hotels = [{ id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }]
    const { orm, updates } = makeOrm(subs, hotels)
    const calls: any[] = []
    const cron = createTrialReminderCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)
    expect(result).toEqual({ ending: 0, expired: 0 })
    expect(calls).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('faltan más de 2 días: no manda nada todavía', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(5) }]
    const hotels = [{ id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }]
    const { orm } = makeOrm(subs, hotels)
    const calls: any[] = []
    const cron = createTrialReminderCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)
    expect(result).toEqual({ ending: 0, expired: 0 })
    expect(calls).toHaveLength(0)
  })

  it('hotel sin email: no manda ni explota', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(1) }]
    const hotels = [{ id: 'h1', name: 'Hotel Sol' }] // sin email
    const { orm } = makeOrm(subs, hotels)
    const calls: any[] = []
    const cron = createTrialReminderCron(orm, makeResolveModule(async (...a) => { calls.push(a); return { sent: true } }), silentLogger())

    const result = await cron(NOW)
    expect(result).toEqual({ ending: 0, expired: 0 })
    expect(calls).toHaveLength(0)
  })

  it('módulo platform-emails no disponible: no explota, devuelve ceros', async () => {
    const subs = [{ id: 'sub1', hotelId: 'h1', status: 'trialing', trialEndsAt: isoDaysFromNow(1) }]
    const { orm } = makeOrm(subs, [])
    const cron = createTrialReminderCron(orm, () => null, silentLogger())

    const result = await cron(NOW)
    expect(result).toEqual({ ending: 0, expired: 0 })
  })

  it('un error inesperado no rompe el cron (try/catch general)', async () => {
    const orm = {
      findMany: async () => { throw new Error('DB caída') },
      findById: async () => null,
      update: async () => null,
    }
    const cron = createTrialReminderCron(orm, makeResolveModule(async () => ({ sent: true })), silentLogger())
    const result = await cron(NOW)
    expect(result).toEqual({ ending: 0, expired: 0 })
  })
})
