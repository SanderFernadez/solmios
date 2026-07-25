// link-signup.test.ts — vinculación del alta pública con el código de referido usado.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { LinkSignupUseCase } from '../usecases/link-signup'

function makeRepo(data: any[]) {
  return {
    findMany: async (filter: Record<string, unknown> = {}) =>
      data.filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v)),
    findById: async (id: string) => data.find((d: any) => d.id === id) ?? null,
    findOne: async () => null,
    create: async (d: any) => { const row = { id: d.id ?? crypto.randomUUID(), ...d }; data.push(row); return row },
    update: async (id: string, patch: any) => { const row = data.find((d: any) => d.id === id); if (row) Object.assign(row, patch); return row ?? null },
    delete: async () => true,
    count: async () => data.length,
    paginate: async () => ({ data, total: data.length, limit: 20, offset: 0, pages: 1 }),
  }
}

function makeConfigRepo(enabled: boolean) {
  return makeRepo([{ id: 'cfg', hotelId: 'platform', key: 'referral_program', value: { enabled } }])
}

describe('LinkSignupUseCase.linkSignup', () => {
  it('vincula correctamente cuando el código existe y el programa está activo', async () => {
    const referralCodesRepo = makeRepo([{ id: 'c1', hotelId: 'h-referrer', code: 'hotel-sol-x1y2' }])
    const referralsRepo = makeRepo([])
    const uc = new LinkSignupUseCase({
      referralCodesRepo: referralCodesRepo as any, referralsRepo: referralsRepo as any,
      configRepo: makeConfigRepo(true) as any, logger: silentLogger(),
    })

    await uc.linkSignup('h-new', 'hotel-sol-x1y2')

    const rows = await referralsRepo.findMany({})
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ referrerHotelId: 'h-referrer', referredHotelId: 'h-new', status: 'trial', code: 'hotel-sol-x1y2' })
  })

  it('código inexistente: no crea nada, no tira', async () => {
    const referralsRepo = makeRepo([])
    const uc = new LinkSignupUseCase({
      referralCodesRepo: makeRepo([]) as any, referralsRepo: referralsRepo as any,
      configRepo: makeConfigRepo(true) as any, logger: silentLogger(),
    })
    await uc.linkSignup('h-new', 'codigo-que-no-existe')
    expect(await referralsRepo.findMany({})).toHaveLength(0)
  })

  it('programa desactivado: no vincula aunque el código exista', async () => {
    const referralsRepo = makeRepo([])
    const uc = new LinkSignupUseCase({
      referralCodesRepo: makeRepo([{ id: 'c1', hotelId: 'h-referrer', code: 'x' }]) as any,
      referralsRepo: referralsRepo as any, configRepo: makeConfigRepo(false) as any, logger: silentLogger(),
    })
    await uc.linkSignup('h-new', 'x')
    expect(await referralsRepo.findMany({})).toHaveLength(0)
  })

  it('anti-autoreferral: si el código resuelve al mismo hotelId, no vincula', async () => {
    const referralsRepo = makeRepo([])
    const uc = new LinkSignupUseCase({
      referralCodesRepo: makeRepo([{ id: 'c1', hotelId: 'h1', code: 'x' }]) as any,
      referralsRepo: referralsRepo as any, configRepo: makeConfigRepo(true) as any, logger: silentLogger(),
    })
    await uc.linkSignup('h1', 'x') // mismo hotelId que el dueño del código
    expect(await referralsRepo.findMany({})).toHaveLength(0)
  })

  it('idempotente: si ya existe un Referrals para ese hotelId, no duplica', async () => {
    const referralsRepo = makeRepo([{ id: 'r1', referrerHotelId: 'h-referrer', referredHotelId: 'h-new', code: 'x', status: 'trial' }])
    const uc = new LinkSignupUseCase({
      referralCodesRepo: makeRepo([{ id: 'c1', hotelId: 'h-referrer', code: 'x' }]) as any,
      referralsRepo: referralsRepo as any, configRepo: makeConfigRepo(true) as any, logger: silentLogger(),
    })
    await uc.linkSignup('h-new', 'x')
    expect(await referralsRepo.findMany({ referredHotelId: 'h-new' })).toHaveLength(1)
  })

  it('código vacío: no explota', async () => {
    const uc = new LinkSignupUseCase({
      referralCodesRepo: makeRepo([]) as any, referralsRepo: makeRepo([]) as any,
      configRepo: makeConfigRepo(true) as any, logger: silentLogger(),
    })
    await uc.linkSignup('h-new', '')
    await uc.linkSignup('h-new', undefined as any)
  })
})
