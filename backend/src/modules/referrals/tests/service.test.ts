// service.test.ts — ReferralTiersUseCase, ShareLinkUseCase y ReferralsService.resolveCode.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { ReferralTiersUseCase } from '../usecases/tiers'
import { ShareLinkUseCase } from '../usecases/share-link'
import { ReferralsService } from '../service'

function makeRepo(data: any[]) {
  return {
    findMany: async (filter: Record<string, unknown> = {}) =>
      data.filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v)),
    findById: async (id: string) => data.find((d: any) => d.id === id) ?? null,
    findOne: async (filter: Record<string, unknown>) => data.find((d) => Object.entries(filter).every(([k, v]) => d[k] === v)) ?? null,
    create: async (d: any) => { const row = { id: d.id ?? crypto.randomUUID(), ...d }; data.push(row); return row },
    update: async (id: string, patch: any) => { const row = data.find((d: any) => d.id === id); if (row) Object.assign(row, patch); return row ?? null },
    delete: async (id: string) => { const idx = data.findIndex((d: any) => d.id === id); if (idx === -1) return false; data.splice(idx, 1); return true },
    count: async () => data.length,
    paginate: async () => ({ data, total: data.length, limit: 20, offset: 0, pages: 1 }),
  }
}

describe('ReferralTiersUseCase', () => {
  it('list() devuelve los tramos ordenados por fromCount', async () => {
    const uc = new ReferralTiersUseCase(makeRepo([
      { id: 't2', fromCount: 3, monthsGranted: 2 }, { id: 't1', fromCount: 1, monthsGranted: 1 },
    ]) as any)
    const { data, total } = await uc.list()
    expect(total).toBe(2)
    expect(data[0].fromCount).toBe(1)
  })

  it('create() rechaza fromCount < 1', async () => {
    const uc = new ReferralTiersUseCase(makeRepo([]) as any)
    await expect(uc.create({ fromCount: 0, monthsGranted: 1 })).rejects.toThrow('fromCount')
  })

  it('update() sin auth cableado no exige assertOwnership (auth opcional)', async () => {
    const repo = makeRepo([{ id: 't1', fromCount: 1, monthsGranted: 1, sortOrder: 1 }])
    const uc = new ReferralTiersUseCase(repo as any) // sin auth
    const updated = await uc.update('t1', { monthsGranted: 5 })
    expect(updated.monthsGranted).toBe(5)
  })

  it('update() con auth cableado exige rol super_admin (assertOwnership real)', async () => {
    const repo = makeRepo([{ id: 't1', fromCount: 1, monthsGranted: 1, sortOrder: 1 }])
    const auth = {
      assertOwnership: (_resource: string, _userId: string, role: string, adminRole: string) => {
        if (role !== adminRole) throw new Error('Forbidden')
      },
    }
    const uc = new ReferralTiersUseCase(repo as any, auth)
    await expect(uc.update('t1', { monthsGranted: 5 }, { id: 'u1', role: 'hotel_admin' })).rejects.toThrow('Forbidden')
    const ok = await uc.update('t1', { monthsGranted: 5 }, { id: 'u1', role: 'super_admin' })
    expect(ok.monthsGranted).toBe(5)
  })

  it('tierMonths: sin tramos configurados no inventa un default (0)', () => {
    expect(ReferralTiersUseCase.tierMonths(3, [])).toBe(0)
  })

  it('tierMonths: usa el tramo con mayor fromCount <= count', () => {
    const tiers = [
      { id: 't1', fromCount: 1, monthsGranted: 1, sortOrder: 1 },
      { id: 't2', fromCount: 3, monthsGranted: 2, sortOrder: 2 },
      { id: 't3', fromCount: 5, monthsGranted: 3, sortOrder: 3 },
    ]
    expect(ReferralTiersUseCase.tierMonths(1, tiers)).toBe(1)
    expect(ReferralTiersUseCase.tierMonths(2, tiers)).toBe(1)
    expect(ReferralTiersUseCase.tierMonths(4, tiers)).toBe(2)
    expect(ReferralTiersUseCase.tierMonths(10, tiers)).toBe(3)
  })
})

describe('ShareLinkUseCase', () => {
  it('getOrCreateCode: primera vez genera y persiste un código con el slug del hotel', async () => {
    const codesRepo = makeRepo([])
    const hotelsRepo = makeRepo([{ id: 'h1', name: 'Hotel Sol Café' }])
    const uc = new ShareLinkUseCase({
      referralCodesRepo: codesRepo as any, referralsRepo: makeRepo([]) as any,
      referralCreditsRepo: makeRepo([]) as any, referralTiersRepo: makeRepo([]) as any, hotelsRepo: hotelsRepo as any,
    })
    const code = await uc.getOrCreateCode('h1')
    expect(code.startsWith('hotel-sol-cafe-')).toBe(true)
    expect((codesRepo as any).findMany).toBeTruthy()
  })

  it('getOrCreateCode: segunda vez devuelve el mismo código (no genera otro)', async () => {
    const codesRepo = makeRepo([])
    const hotelsRepo = makeRepo([{ id: 'h1', name: 'Hotel Sol' }])
    const uc = new ShareLinkUseCase({
      referralCodesRepo: codesRepo as any, referralsRepo: makeRepo([]) as any,
      referralCreditsRepo: makeRepo([]) as any, referralTiersRepo: makeRepo([]) as any, hotelsRepo: hotelsRepo as any,
    })
    const code1 = await uc.getOrCreateCode('h1')
    const code2 = await uc.getOrCreateCode('h1')
    expect(code1).toBe(code2)
  })

  it('me(): arma código+link+referidos+créditos+progreso al próximo tramo', async () => {
    const codesRepo = makeRepo([{ id: 'c1', hotelId: 'h1', code: 'hotel-sol-x1y2' }])
    const hotelsRepo = makeRepo([{ id: 'h1', name: 'Hotel Sol' }, { id: 'h2', name: 'Hotel Mar' }])
    const referralsRepo = makeRepo([
      { id: 'r1', referrerHotelId: 'h1', referredHotelId: 'h2', code: 'hotel-sol-x1y2', status: 'validated', activeSince: '2026-01-01', validatedAt: '2026-04-01' },
    ])
    const creditsRepo = makeRepo([
      { id: 'cr1', referralId: 'r1', referrerHotelId: 'h1', monthsGranted: 1, status: 'released', earnedAt: '2026-04-01', releasedAt: '2026-04-01' },
    ])
    const tiersRepo = makeRepo([{ id: 't1', fromCount: 1, monthsGranted: 1 }, { id: 't2', fromCount: 3, monthsGranted: 2 }])
    const uc = new ShareLinkUseCase({
      referralCodesRepo: codesRepo as any, referralsRepo: referralsRepo as any,
      referralCreditsRepo: creditsRepo as any, referralTiersRepo: tiersRepo as any, hotelsRepo: hotelsRepo as any,
    })
    const me = await uc.me('h1')
    expect(me.code).toBe('hotel-sol-x1y2')
    expect(me.shareLink).toContain('/r/hotel-sol-x1y2')
    expect(me.referrals).toHaveLength(1)
    expect(me.referrals[0].referredHotelName).toBe('Hotel Mar')
    expect(me.totalMonthsEarned).toBe(1)
    expect(me.referralsUntilNextTier).toBe(2) // tiene 1 validado, el próximo tramo pide 3
    expect(me.nextTierMonths).toBe(2)
  })
})

describe('ReferralsService.resolveCode', () => {
  it('resuelve el nombre del hotel referidor a partir del código', async () => {
    const svc = new ReferralsService(
      makeRepo([{ id: 'c1', hotelId: 'h1', code: 'hotel-sol-x1y2' }]) as any,
      makeRepo([]) as any, makeRepo([]) as any, makeRepo([]) as any,
      makeRepo([{ id: 'h1', name: 'Hotel Sol' }]) as any, makeRepo([]) as any, silentLogger(),
    )
    const result = await svc.resolveCode('hotel-sol-x1y2')
    expect(result.referrerHotelName).toBe('Hotel Sol')
  })

  it('404 si el código no existe', async () => {
    const svc = new ReferralsService(
      makeRepo([]) as any, makeRepo([]) as any, makeRepo([]) as any, makeRepo([]) as any,
      makeRepo([]) as any, makeRepo([]) as any, silentLogger(),
    )
    await expect(svc.resolveCode('inexistente')).rejects.toThrow('no encontrado')
  })
})
