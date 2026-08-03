// service.test.ts — eligibilidad, conversión manual, tramos de comisión y payout-mode del
// programa "Aliados". Mismo molde que referrals/tests/service.test.ts (makeRepo fake).
import { describe, it, expect } from 'bun:test'
import { checkEligibility, MIN_VALIDATED_REFERRALS_FOR_ALIADO } from '../usecases/eligibility'
import { convertToAliado } from '../usecases/convert-to-aliado'
import {
  PartnerCommissionTiersUseCase, resolvePercentFromTiers, CERTIFIED_PARTNER_PERCENT,
} from '../usecases/commission-tiers'
import { setPayoutMode } from '../usecases/payout-mode'
import { markPaid } from '../usecases/mark-commission-paid'
import {
  applyForCertification, approveCertification, rejectCertification,
} from '../usecases/certification'

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

function validatedReferrals(hotelId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`, referrerHotelId: hotelId, referredHotelId: `h-referred-${i}`, code: 'x', status: 'validated',
  }))
}

describe('checkEligibility', () => {
  it('exactamente 5 validados NO es elegible (regla es > 5, no >= 5)', async () => {
    const referralsRepo = makeRepo(validatedReferrals('h1', 5))
    const partnersRepo = makeRepo([])
    const result = await checkEligibility(referralsRepo as any, partnersRepo as any, 'h1')
    expect(result.validatedCount).toBe(5)
    expect(result.isEligible).toBe(false)
  })

  it('6 validados SÍ es elegible', async () => {
    const referralsRepo = makeRepo(validatedReferrals('h1', 6))
    const partnersRepo = makeRepo([])
    const result = await checkEligibility(referralsRepo as any, partnersRepo as any, 'h1')
    expect(result.isEligible).toBe(true)
  })

  it('alreadyPartner:true si el hotel ya tiene una fila en Partners', async () => {
    const referralsRepo = makeRepo(validatedReferrals('h1', 6))
    const partnersRepo = makeRepo([{ id: 'p1', hotelId: 'h1', type: 'aliado' }])
    const result = await checkEligibility(referralsRepo as any, partnersRepo as any, 'h1')
    expect(result.alreadyPartner).toBe(true)
  })
})

describe('convertToAliado', () => {
  it('rechaza la conversión si no cumple el mínimo de referidos validados', async () => {
    const referralsRepo = makeRepo(validatedReferrals('h1', 3))
    const partnersRepo = makeRepo([])
    await expect(convertToAliado(partnersRepo as any, referralsRepo as any, 'h1')).rejects.toThrow()
  })

  it('rechaza si el hotel ya es partner', async () => {
    const referralsRepo = makeRepo(validatedReferrals('h1', 6))
    const partnersRepo = makeRepo([{ id: 'p1', hotelId: 'h1', type: 'aliado' }])
    await expect(convertToAliado(partnersRepo as any, referralsRepo as any, 'h1')).rejects.toThrow('ya es Aliado')
  })

  it('crea el Partner tipo aliado con payoutMode monthly cuando es elegible (acción manual, no automática)', async () => {
    const referralsRepo = makeRepo(validatedReferrals('h1', 6))
    const partnersRepo = makeRepo([])
    const partner = await convertToAliado(partnersRepo as any, referralsRepo as any, 'h1')
    expect(partner.type).toBe('aliado')
    expect(partner.payoutMode).toBe('monthly')
    expect(partner.status).toBe('active')
    expect((await partnersRepo.findMany({ hotelId: 'h1' })).length).toBe(1)
  })
})

describe('resolvePercentFromTiers', () => {
  const tiers = [
    { id: 't1', fromCount: 0, percent: 10, sortOrder: 0 },
    { id: 't2', fromCount: 5, percent: 12, sortOrder: 5 },
    { id: 't3', fromCount: 10, percent: 15, sortOrder: 10 },
    { id: 't4', fromCount: 20, percent: 18, sortOrder: 20 },
    { id: 't5', fromCount: 40, percent: 20, sortOrder: 40 },
  ] as any[]

  it('umbrales exactos', () => {
    expect(resolvePercentFromTiers(0, 'aliado', tiers)).toBe(10)
    expect(resolvePercentFromTiers(5, 'aliado', tiers)).toBe(12)
    expect(resolvePercentFromTiers(10, 'aliado', tiers)).toBe(15)
    expect(resolvePercentFromTiers(20, 'aliado', tiers)).toBe(18)
    expect(resolvePercentFromTiers(40, 'aliado', tiers)).toBe(20)
  })

  it('valores intermedios usan el tramo con mayor fromCount <= count', () => {
    expect(resolvePercentFromTiers(4, 'aliado', tiers)).toBe(10)
    expect(resolvePercentFromTiers(7, 'aliado', tiers)).toBe(12)
    expect(resolvePercentFromTiers(15, 'aliado', tiers)).toBe(15)
    expect(resolvePercentFromTiers(35, 'aliado', tiers)).toBe(18)
    expect(resolvePercentFromTiers(100, 'aliado', tiers)).toBe(20)
  })

  it('aliado_certificado es SIEMPRE 20% fijo, sin importar el conteo ni los tramos', () => {
    expect(resolvePercentFromTiers(0, 'aliado_certificado', tiers)).toBe(CERTIFIED_PARTNER_PERCENT)
    expect(resolvePercentFromTiers(1, 'aliado_certificado', [])).toBe(CERTIFIED_PARTNER_PERCENT)
    expect(resolvePercentFromTiers(500, 'aliado_certificado', tiers)).toBe(CERTIFIED_PARTNER_PERCENT)
  })

  it('sin tramos configurados, aliado normal no inventa un default (0)', () => {
    expect(resolvePercentFromTiers(10, 'aliado', [])).toBe(0)
  })
})

describe('PartnerCommissionTiersUseCase.replaceAll', () => {
  it('reemplaza el set completo de tramos', async () => {
    const repo = makeRepo([{ id: 't1', fromCount: 0, percent: 10, sortOrder: 0 }])
    const uc = new PartnerCommissionTiersUseCase(repo as any)
    const result = await uc.replaceAll([{ fromCount: 0, percent: 11 }, { fromCount: 5, percent: 13 }])
    expect(result).toHaveLength(2)
    const { data } = await uc.list()
    expect(data).toHaveLength(2)
    expect(data[0].percent).toBe(11)
  })

  it('valida percent fuera de rango', async () => {
    const uc = new PartnerCommissionTiersUseCase(makeRepo([]) as any)
    await expect(uc.replaceAll([{ fromCount: 0, percent: 150 }])).rejects.toThrow('percent')
  })
})

describe('setPayoutMode', () => {
  it('un aliado normal puede elegir one_time', async () => {
    const partnersRepo = makeRepo([{ id: 'p1', hotelId: 'h1', type: 'aliado', payoutMode: 'monthly' }])
    const updated = await setPayoutMode(partnersRepo as any, 'h1', 'one_time')
    expect(updated.payoutMode).toBe('one_time')
  })

  it('aliado_certificado NO puede setear payoutMode one_time', async () => {
    const partnersRepo = makeRepo([{ id: 'p1', hotelId: 'h1', type: 'aliado_certificado', payoutMode: 'monthly' }])
    await expect(setPayoutMode(partnersRepo as any, 'h1', 'one_time')).rejects.toThrow('Aliado Certificado')
  })

  it('404 si el hotel no es partner', async () => {
    const partnersRepo = makeRepo([])
    await expect(setPayoutMode(partnersRepo as any, 'h1', 'one_time')).rejects.toThrow()
  })
})

describe('markPaid', () => {
  it('marca una comisión como paid_out con paidAt seteado', async () => {
    const commissionsRepo = makeRepo([{ id: 'c1', status: 'active', paidAt: null }])
    const updated = await markPaid(commissionsRepo as any, 'c1')
    expect(updated.status).toBe('paid_out')
    expect(updated.paidAt).not.toBeNull()
  })

  it('rechaza marcar pagada una comisión cancelada', async () => {
    const commissionsRepo = makeRepo([{ id: 'c1', status: 'cancelled' }])
    await expect(markPaid(commissionsRepo as any, 'c1')).rejects.toThrow()
  })
})

describe('certification flow', () => {
  it('approveCertification crea el Partner tipo aliado_certificado, payoutMode monthly fijo', async () => {
    const requestsRepo = makeRepo([{ id: 'req1', hotelId: 'h1', status: 'pending', answers: {} }])
    const partnersRepo = makeRepo([])
    const partner = await approveCertification(requestsRepo as any, partnersRepo as any, 'req1', 'admin1')
    expect(partner.type).toBe('aliado_certificado')
    expect(partner.payoutMode).toBe('monthly')
    expect(partner.certifiedAt).not.toBeNull()
  })

  it('approveCertification sobre un partner ya existente (aliado → certificado) lo actualiza en vez de duplicar', async () => {
    const requestsRepo = makeRepo([{ id: 'req1', hotelId: 'h1', status: 'pending', answers: {} }])
    const partnersRepo = makeRepo([{ id: 'p1', hotelId: 'h1', type: 'aliado', payoutMode: 'one_time', status: 'active', becamePartnerAt: '2026-01-01', certifiedAt: null }])
    const partner = await approveCertification(requestsRepo as any, partnersRepo as any, 'req1', 'admin1')
    expect(partner.id).toBe('p1')
    expect(partner.type).toBe('aliado_certificado')
    expect(partner.payoutMode).toBe('monthly')
    expect((await partnersRepo.findMany({ hotelId: 'h1' })).length).toBe(1)
  })

  it('rejectCertification marca la solicitud como rechazada sin tocar Partners', async () => {
    const requestsRepo = makeRepo([{ id: 'req1', hotelId: 'h1', status: 'pending', answers: {} }])
    const rejected = await rejectCertification(requestsRepo as any, 'req1', 'admin1')
    expect(rejected.status).toBe('rejected')
  })

  it('applyForCertification rechaza una segunda solicitud mientras haya una pending', async () => {
    const requestsRepo = makeRepo([{ id: 'req1', hotelId: 'h1', status: 'pending', answers: {} }])
    await expect(applyForCertification(requestsRepo as any, 'h1', { experience: 'yes' })).rejects.toThrow()
  })
})

describe('MIN_VALIDATED_REFERRALS_FOR_ALIADO', () => {
  it('es 5 (el umbral documentado en el issue #549)', () => {
    expect(MIN_VALIDATED_REFERRALS_FOR_ALIADO).toBe(5)
  })
})
