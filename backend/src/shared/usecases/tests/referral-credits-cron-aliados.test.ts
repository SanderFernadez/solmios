// referral-credits-cron-aliados.test.ts — Cobertura del cambio del programa "Aliados" sobre
// referral-credits-cron.ts (paso 2 y paso 5 nuevo): un referidor que es Partner activo gana
// PartnerCommissions en vez de ReferralCredits, y el pago único se libera/cancela según la
// ventana de clawback. Fake orm en memoria (mismo espíritu que otros tests de crons del repo,
// que usan silentLogger + un stub mínimo en vez de levantar el ORM real).
import { describe, it, expect } from 'bun:test'
import { createReferralCreditsCron } from '../referral-credits-cron'

function makeFakeOrm(tables: Record<string, any[]>) {
  return {
    findMany: async (table: string, filter: Record<string, unknown> = {}) => {
      const rows = tables[table] ?? []
      return rows.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v))
    },
    create: async (table: string, data: any) => {
      const row = { id: data.id ?? crypto.randomUUID(), ...data }
      tables[table] = tables[table] ?? []
      tables[table].push(row)
      return row
    },
    update: async (table: string, id: string, patch: any) => {
      const row = (tables[table] ?? []).find((r) => r.id === id)
      if (row) Object.assign(row, patch)
      return row ?? null
    },
  }
}

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} }
const noopResolveModule = () => undefined

const enabledProgramConfig = {
  id: 'cfg1', hotelId: 'platform', key: 'referral_program',
  value: { enabled: true, activeMonthsRequired: 3, requirePaidStatus: true, maxAccumulatedMonths: 12, clawbackWindowDays: 30, referredRewardValue: 0 },
}

describe('referral-credits-cron — programa Aliados', () => {
  it('NO crea ReferralCredits para un referidor que es Partner activo (crea PartnerCommissions en cambio)', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z')
    const activeSince = new Date('2026-01-01T00:00:00.000Z').toISOString() // 4 meses atrás > activeMonthsRequired:3
    const tables: Record<string, any[]> = {
      Configuration: [enabledProgramConfig],
      Referrals: [{ id: 'r1', referrerHotelId: 'h-partner', referredHotelId: 'h-referred', code: 'x', status: 'active', activeSince, welcomeRewardStatus: 'skipped' }],
      Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'active', planId: 'plan-starter' }],
      ReferralTiers: [],
      PartnerCommissionTiers: [{ id: 't1', fromCount: 0, percent: 10 }],
      Partners: [{ id: 'p1', hotelId: 'h-partner', type: 'aliado', payoutMode: 'monthly', status: 'active', becamePartnerAt: '2026-01-01' }],
      ReferralCredits: [],
      PartnerCommissions: [],
      Plans: [{ id: 'plan-starter', price: 49 }],
    }
    const orm = makeFakeOrm(tables)
    const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
    const result = await cron(now)

    expect(result.validated).toBe(1)
    expect(tables.ReferralCredits).toHaveLength(0)
    expect(tables.PartnerCommissions).toHaveLength(1)
    expect(result.partnerCommissionsCreated).toBe(1)
    expect(tables.PartnerCommissions[0].percent).toBe(10)
    expect(tables.PartnerCommissions[0].payoutMode).toBe('monthly')
    expect(tables.PartnerCommissions[0].status).toBe('active') // monthly válida de una: 'active', no 'pending_payout'
  })

  it('payoutMode one_time queda pending_payout al validar (no active)', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z')
    const activeSince = new Date('2026-01-01T00:00:00.000Z').toISOString()
    const tables: Record<string, any[]> = {
      Configuration: [enabledProgramConfig],
      Referrals: [{ id: 'r1', referrerHotelId: 'h-partner', referredHotelId: 'h-referred', code: 'x', status: 'active', activeSince, welcomeRewardStatus: 'skipped' }],
      Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'active', planId: 'plan-starter' }],
      ReferralTiers: [],
      PartnerCommissionTiers: [{ id: 't1', fromCount: 0, percent: 10 }],
      Partners: [{ id: 'p1', hotelId: 'h-partner', type: 'aliado', payoutMode: 'one_time', status: 'active', becamePartnerAt: '2026-01-01' }],
      ReferralCredits: [],
      PartnerCommissions: [],
      Plans: [{ id: 'plan-starter', price: 49 }],
    }
    const orm = makeFakeOrm(tables)
    const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
    await cron(now)

    expect(tables.PartnerCommissions[0].status).toBe('pending_payout')
    expect(tables.PartnerCommissions[0].payoutAmount).toBeNull()
  })

  it('aliado_certificado gana 20% fijo aunque no haya tramos configurados', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z')
    const activeSince = new Date('2026-01-01T00:00:00.000Z').toISOString()
    const tables: Record<string, any[]> = {
      Configuration: [enabledProgramConfig],
      Referrals: [{ id: 'r1', referrerHotelId: 'h-partner', referredHotelId: 'h-referred', code: 'x', status: 'active', activeSince, welcomeRewardStatus: 'skipped' }],
      Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'active', planId: 'plan-starter' }],
      ReferralTiers: [],
      PartnerCommissionTiers: [], // sin tramos: igual debe dar 20% por ser certificado
      Partners: [{ id: 'p1', hotelId: 'h-partner', type: 'aliado_certificado', payoutMode: 'monthly', status: 'active', becamePartnerAt: '2026-01-01' }],
      ReferralCredits: [],
      PartnerCommissions: [],
      Plans: [],
    }
    const orm = makeFakeOrm(tables)
    const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
    await cron(now)

    expect(tables.PartnerCommissions[0].percent).toBe(20)
  })

  it('sigue creando ReferralCredits normal cuando el referidor NO es partner', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z')
    const activeSince = new Date('2026-01-01T00:00:00.000Z').toISOString()
    const tables: Record<string, any[]> = {
      Configuration: [enabledProgramConfig],
      Referrals: [{ id: 'r1', referrerHotelId: 'h-normal', referredHotelId: 'h-referred', code: 'x', status: 'active', activeSince, welcomeRewardStatus: 'skipped' }],
      Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'active' }],
      ReferralTiers: [{ id: 't1', fromCount: 0, monthsGranted: 1 }],
      PartnerCommissionTiers: [],
      Partners: [],
      ReferralCredits: [],
      PartnerCommissions: [],
      Plans: [],
    }
    const orm = makeFakeOrm(tables)
    const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
    await cron(now)

    expect(tables.ReferralCredits).toHaveLength(1)
    expect(tables.PartnerCommissions).toHaveLength(0)
  })

  describe('liberación / cancelación de pago único (paso 5)', () => {
    it('libera el pago único (paid_out + payoutAmount) tras pasar la ventana si el referido sigue activo', async () => {
      const validatedAt = new Date('2026-01-01T00:00:00.000Z').toISOString()
      const now = new Date('2026-02-05T00:00:00.000Z') // 35 días > clawbackWindowDays:30
      const tables: Record<string, any[]> = {
        Configuration: [enabledProgramConfig],
        Referrals: [],
        Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'active', planId: 'plan-starter' }],
        ReferralTiers: [],
        PartnerCommissionTiers: [],
        Partners: [],
        ReferralCredits: [],
        PartnerCommissions: [{ id: 'c1', partnerId: 'p1', referralId: 'r1', referredHotelId: 'h-referred', percent: 10, payoutMode: 'one_time', status: 'pending_payout', payoutAmount: null, validatedAt, paidAt: null }],
        Plans: [{ id: 'plan-starter', price: 49 }],
      }
      const orm = makeFakeOrm(tables)
      const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
      const result = await cron(now)

      expect(tables.PartnerCommissions[0].status).toBe('paid_out')
      expect(tables.PartnerCommissions[0].payoutAmount).toBe(49)
      expect(tables.PartnerCommissions[0].paidAt).toBeNull() // liberar ≠ pagar: paidAt lo setea markPaid, no el cron
      expect(result.partnerPayoutsReleased).toBe(1)
    })

    it('cancela el pago único si el referido se da de baja DENTRO de la ventana', async () => {
      const validatedAt = new Date('2026-01-01T00:00:00.000Z').toISOString()
      const now = new Date('2026-01-15T00:00:00.000Z') // 14 días, dentro de la ventana de 30
      const tables: Record<string, any[]> = {
        Configuration: [enabledProgramConfig],
        Referrals: [],
        Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'canceled' }],
        ReferralTiers: [],
        PartnerCommissionTiers: [],
        Partners: [],
        ReferralCredits: [],
        PartnerCommissions: [{ id: 'c1', partnerId: 'p1', referralId: 'r1', referredHotelId: 'h-referred', percent: 10, payoutMode: 'one_time', status: 'pending_payout', payoutAmount: null, validatedAt, paidAt: null }],
        Plans: [],
      }
      const orm = makeFakeOrm(tables)
      const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
      const result = await cron(now)

      expect(tables.PartnerCommissions[0].status).toBe('cancelled')
      expect(result.partnerCommissionsCancelled).toBe(1)
    })

    it('no toca la comisión mientras siga dentro de la ventana y el referido esté activo', async () => {
      const validatedAt = new Date('2026-01-01T00:00:00.000Z').toISOString()
      const now = new Date('2026-01-10T00:00:00.000Z') // 9 días, dentro de la ventana
      const tables: Record<string, any[]> = {
        Configuration: [enabledProgramConfig],
        Referrals: [],
        Subscriptions: [{ id: 's1', hotelId: 'h-referred', status: 'active' }],
        ReferralTiers: [],
        PartnerCommissionTiers: [],
        Partners: [],
        ReferralCredits: [],
        PartnerCommissions: [{ id: 'c1', partnerId: 'p1', referralId: 'r1', referredHotelId: 'h-referred', percent: 10, payoutMode: 'one_time', status: 'pending_payout', payoutAmount: null, validatedAt, paidAt: null }],
        Plans: [],
      }
      const orm = makeFakeOrm(tables)
      const cron = createReferralCreditsCron(orm, noopResolveModule, silentLogger)
      const result = await cron(now)

      expect(tables.PartnerCommissions[0].status).toBe('pending_payout')
      expect(result.partnerPayoutsReleased).toBe(0)
      expect(result.partnerCommissionsCancelled).toBe(0)
    })
  })
})
