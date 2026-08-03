// referral-credits-cron.test.ts — trial→active→validated→released + churn + clawback.
// Mismo molde que subscription-suspension-cron.test.ts: fake ORM en memoria, exact-match por campo.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { createReferralCreditsCron } from '../referral-credits-cron'

const NOW = new Date('2026-07-24T00:00:00.000Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000
const isoDaysFromNow = (days: number) => new Date(NOW.getTime() + days * MS_PER_DAY).toISOString()

function makeOrm(tables: Record<string, any[]>) {
  const store: Record<string, any[]> = { ...tables }
  function matches(row: any, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([k, v]) => row[k] === v)
  }
  const orm = {
    findMany: async (table: string, filters: Record<string, unknown> = {}) =>
      (store[table] ?? []).filter((r) => matches(r, filters)),
    update: async (table: string, id: string, patch: any) => {
      const row = (store[table] ?? []).find((r) => r.id === id)
      if (row) Object.assign(row, patch)
      return row ?? null
    },
    create: async (table: string, data: any) => {
      const row = { id: data.id ?? `${table}-${(store[table]?.length ?? 0) + 1}`, ...data }
      store[table] = [...(store[table] ?? []), row]
      return row
    },
  }
  return { orm, store }
}

function makeResolveModule(applyStripeDiscount: (...a: any[]) => Promise<any>) {
  return (name: string) => (name === 'subscriptions' ? { applyStripeDiscount } : null)
}

const PROGRAM = (over: Partial<any> = {}) => [{
  id: 'cfg', hotelId: 'platform', key: 'referral_program',
  value: { enabled: true, activeMonthsRequired: 3, requirePaidStatus: true, maxAccumulatedMonths: 12, clawbackWindowDays: 30, ...over },
}]

describe('createReferralCreditsCron', () => {
  it('programa desactivado: no hace nada', async () => {
    const { orm } = makeOrm({ Referrals: [{ id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'trial' }], Configuration: [] })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result).toEqual({
      toActive: 0, validated: 0, released: 0, churned: 0, revoked: 0, welcomeApplied: 0, welcomeSkipped: 0,
      partnerCommissionsCreated: 0, partnerPayoutsReleased: 0, partnerCommissionsCancelled: 0,
    })
  })

  it('trial → active: cuando el referido ya tiene Subscription active', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'trial', activeSince: null }
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active' }],
      ReferralTiers: [], Configuration: PROGRAM(),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.toActive).toBe(1)
    expect(store.Referrals[0].status).toBe('active')
    expect(store.Referrals[0].activeSince).toBe(NOW.toISOString())
  })

  it('active → validated + crea ReferralCredits según el tramo, cuando cumple activeMonthsRequired', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: isoDaysFromNow(-95) } // ~3.1 meses
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active' }, { id: 's2', hotelId: 'a', planId: 'p1' }],
      ReferralTiers: [{ id: 't1', fromCount: 1, monthsGranted: 1 }], Configuration: PROGRAM(),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.validated).toBe(1)
    expect(store.Referrals[0].status).toBe('validated')
    expect(store.ReferralCredits).toHaveLength(1)
    expect(store.ReferralCredits[0]).toMatchObject({ referrerHotelId: 'a', monthsGranted: 1, status: 'released' }) // released porque el mismo tick aplica el paso 3
  })

  it('active: todavía no cumple los meses requeridos, no valida', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: isoDaysFromNow(-10) }
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active' }],
      ReferralTiers: [{ id: 't1', fromCount: 1, monthsGranted: 1 }], Configuration: PROGRAM(),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.validated).toBe(0)
    expect(store.Referrals[0].status).toBe('active')
  })

  it('active → churned: el referido se dio de baja antes de validar', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: isoDaysFromNow(-10) }
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'canceled' }], Configuration: PROGRAM(),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.churned).toBe(1)
    expect(store.Referrals[0].status).toBe('churned')
  })

  it('sin tramos configurados: valida pero NO inventa un crédito', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: isoDaysFromNow(-95) }
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active' }],
      ReferralTiers: [], Configuration: PROGRAM(),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.validated).toBe(1)
    expect(store.ReferralCredits ?? []).toHaveLength(0)
  })

  it('crédito pending que excede maxAccumulatedMonths: no se libera, queda pending', async () => {
    const credit = { id: 'c1', referralId: 'r1', referrerHotelId: 'a', monthsGranted: 5, status: 'pending', earnedAt: NOW.toISOString() }
    const alreadyReleased = { id: 'c0', referralId: 'r0', referrerHotelId: 'a', monthsGranted: 10, status: 'released', earnedAt: '2026-01-01' }
    const { orm, store } = makeOrm({
      Referrals: [], ReferralCredits: [credit, alreadyReleased], Configuration: PROGRAM({ maxAccumulatedMonths: 12 }),
    })
    const applyStripeDiscount = async () => ({ applied: true })
    const cron = createReferralCreditsCron(orm, makeResolveModule(applyStripeDiscount), silentLogger())
    const result = await cron(NOW)
    expect(result.released).toBe(0)
    expect(store.ReferralCredits.find((c: any) => c.id === 'c1').status).toBe('pending')
  })

  it('crédito pending: si Stripe no puede aplicarlo (sin stripeSubscriptionId), sigue pending', async () => {
    const credit = { id: 'c1', referralId: 'r1', referrerHotelId: 'a', monthsGranted: 1, status: 'pending', earnedAt: NOW.toISOString() }
    const { orm, store } = makeOrm({ Referrals: [], ReferralCredits: [credit], Configuration: PROGRAM() })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: false, reason: 'sin suscripción de Stripe activa' })), silentLogger())
    const result = await cron(NOW)
    expect(result.released).toBe(0)
    expect(store.ReferralCredits[0].status).toBe('pending')
  })

  it('clawback: el referido se da de baja dentro de la ventana → revoca el crédito', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'validated', validatedAt: isoDaysFromNow(-10) }
    const credit = { id: 'c1', referralId: 'r1', referrerHotelId: 'a', monthsGranted: 1, status: 'released', earnedAt: isoDaysFromNow(-10) }
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'canceled' }],
      ReferralCredits: [credit], Configuration: PROGRAM({ clawbackWindowDays: 30 }),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.revoked).toBe(1)
    expect(store.ReferralCredits[0].status).toBe('revoked')
  })

  it('clawback: fuera de la ventana → NO revoca (el crédito ya es definitivo)', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'validated', validatedAt: isoDaysFromNow(-40) }
    const credit = { id: 'c1', referralId: 'r1', referrerHotelId: 'a', monthsGranted: 1, status: 'released', earnedAt: isoDaysFromNow(-40) }
    const { orm, store } = makeOrm({
      Referrals: [referral], Subscriptions: [{ id: 's1', hotelId: 'b', status: 'canceled' }],
      ReferralCredits: [credit], Configuration: PROGRAM({ clawbackWindowDays: 30 }),
    })
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result.revoked).toBe(0)
    expect(store.ReferralCredits[0].status).toBe('released')
  })

  // ─── Descuento de bienvenida al REFERIDO (1er mes gratis, referredRewardValue) ───────────────
  function makeRecordingResolveModule(impl: (...a: any[]) => Promise<any>) {
    const calls: any[][] = []
    const applyStripeDiscount = (...args: any[]) => { calls.push(args); return impl(...args) }
    return { resolveModule: (name: string) => (name === 'subscriptions' ? { applyStripeDiscount } : null), calls }
  }

  it('welcome reward: trial→active con referredRewardValue=100 aplica el cupón al referido', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'trial', activeSince: null }
    const { orm, store } = makeOrm({
      Referrals: [referral],
      Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active', stripeSubscriptionId: 'sub_b' }],
      Configuration: PROGRAM({ referredRewardValue: 100 }),
    })
    const { resolveModule, calls } = makeRecordingResolveModule(async () => ({ applied: true }))
    const cron = createReferralCreditsCron(orm, resolveModule, silentLogger())
    const result = await cron(NOW)

    // Transición trial→active quedó registrada.
    expect(result.toActive).toBe(1)
    expect(store.Referrals[0].status).toBe('active')
    // applyStripeDiscount se llamó contra el hotel REFERIDO, con 100% off por 1 mes y meta referral_welcome.
    expect(result.welcomeApplied).toBe(1)
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('b') // referredHotelId
    expect(calls[0][1]).toBe(100) // referredRewardValue
    expect(calls[0][2]).toBe(1) // durationMonths
    expect(calls[0][3]).toMatchObject({ type: 'referral_welcome', reason: 'Mes de bienvenida por referido' })
    expect(store.Referrals[0].welcomeRewardStatus).toBe('applied')
  })

  it('welcome reward: sin stripeSubscriptionId → queda pending (reintenta próximo tick)', async () => {
    // El applyStripeDiscount real devuelve {applied:false, reason} cuando el referido no tiene
    // stripeSubscriptionId. Acá lo simulamos: el cron NO debe marcarlo 'applied' ni 'skipped'.
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: NOW.toISOString(), welcomeRewardStatus: 'pending' }
    const { orm, store } = makeOrm({
      Referrals: [referral],
      Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active' }], // sin stripeSubscriptionId
      Configuration: PROGRAM({ referredRewardValue: 100 }),
    })
    const { resolveModule, calls } = makeRecordingResolveModule(async () => ({ applied: false, reason: 'sin suscripción de Stripe activa' }))
    const cron = createReferralCreditsCron(orm, resolveModule, silentLogger())
    const result = await cron(NOW)

    expect(result.welcomeApplied).toBe(0)
    expect(result.welcomeSkipped).toBe(0)
    expect(calls).toHaveLength(1) // lo intentó
    expect(store.Referrals[0].welcomeRewardStatus).toBe('pending') // sigue pendiente → reintenta
  })

  it('welcome reward: referredRewardValue=0 → skipped (no reintenta)', async () => {
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: NOW.toISOString(), welcomeRewardStatus: 'pending' }
    const { orm, store } = makeOrm({
      Referrals: [referral],
      Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active', stripeSubscriptionId: 'sub_b' }],
      Configuration: PROGRAM({ referredRewardValue: 0 }),
    })
    const { resolveModule, calls } = makeRecordingResolveModule(async () => ({ applied: true }))
    const cron = createReferralCreditsCron(orm, resolveModule, silentLogger())
    const result = await cron(NOW)

    expect(result.welcomeApplied).toBe(0)
    expect(result.welcomeSkipped).toBe(1)
    expect(calls).toHaveLength(0) // ni siquiera lo intenta: 0 → skip directo
    expect(store.Referrals[0].welcomeRewardStatus).toBe('skipped')
  })

  it('welcome reward: idempotente — una vez applied no se vuelve a aplicar', async () => {
    // Segundo tick: el referral ya está 'applied'. No debe llamarse applyStripeDiscount de nuevo.
    const referral = { id: 'r1', referrerHotelId: 'a', referredHotelId: 'b', status: 'active', activeSince: NOW.toISOString(), welcomeRewardStatus: 'applied' }
    const { orm, store } = makeOrm({
      Referrals: [referral],
      Subscriptions: [{ id: 's1', hotelId: 'b', status: 'active', stripeSubscriptionId: 'sub_b' }],
      Configuration: PROGRAM({ referredRewardValue: 100 }),
    })
    const { resolveModule, calls } = makeRecordingResolveModule(async () => ({ applied: true }))
    const cron = createReferralCreditsCron(orm, resolveModule, silentLogger())
    const result = await cron(NOW)

    expect(result.welcomeApplied).toBe(0)
    expect(calls).toHaveLength(0)
    expect(store.Referrals[0].welcomeRewardStatus).toBe('applied')
  })

  it('un error inesperado no rompe el cron (try/catch general)', async () => {
    const orm = {
      findMany: async () => { throw new Error('DB caída') },
      update: async () => null,
      create: async () => ({}),
    }
    const cron = createReferralCreditsCron(orm, makeResolveModule(async () => ({ applied: true })), silentLogger())
    const result = await cron(NOW)
    expect(result).toEqual({
      toActive: 0, validated: 0, released: 0, churned: 0, revoked: 0, welcomeApplied: 0, welcomeSkipped: 0,
      partnerCommissionsCreated: 0, partnerPayoutsReleased: 0, partnerCommissionsCancelled: 0,
    })
  })
})
