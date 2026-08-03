// aliados/tests/hotel-support.test.ts — #559: soporte de Aliado Certificado a sus hoteles.
// Foco adversarial: ownership NUNCA debe confiar en el hotelId del cliente sin cruzarlo contra
// Referrals (mismo patrón de bug histórico que guests-detail-alignment/silent-field-drop).
import { describe, it, expect } from 'bun:test'
import {
  listMyReferredHotels, updateReferredHotelBasics, assertCertifiedActivePartner, assertReferredAndValidated,
  type HotelSupportDeps,
} from '../usecases/hotel-support'

function fakeDeps(over: Partial<{
  partners: any[]; referrals: any[]; hotels: Record<string, any>; media: any[]
}> = {}): HotelSupportDeps {
  const partners = over.partners ?? []
  const referrals = over.referrals ?? []
  const hotels = over.hotels ?? {}
  const media = over.media ?? []
  return {
    partnersRepo: { findMany: async (q: any) => partners.filter((p) => Object.entries(q).every(([k, v]) => p[k] === v)) } as any,
    referralsRepo: { findMany: async (q: any) => referrals.filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)) } as any,
    hotelsRepo: {
      findOne: async (q: any) => hotels[q.id] ?? null,
      update: async (id: string, patch: any) => { hotels[id] = { ...hotels[id], ...patch }; return hotels[id] },
    } as any,
    hotelMediaRepo: { findMany: async (q: any) => media.filter((m) => m.hotelId === q.hotelId) } as any,
  }
}

const certifiedPartner = { id: 'p1', hotelId: 'ally1', type: 'aliado_certificado', status: 'active' }
const normalPartner = { id: 'p2', hotelId: 'ally2', type: 'aliado', status: 'active' }

describe('assertCertifiedActivePartner (#559)', () => {
  it('rechaza a un hotel que no es partner', async () => {
    const deps = fakeDeps({ partners: [] })
    await expect(assertCertifiedActivePartner(deps, 'ally1')).rejects.toThrow('exclusiva de Aliados Certificados')
  })
  it('rechaza a un Aliado normal (no certificado)', async () => {
    const deps = fakeDeps({ partners: [normalPartner] })
    await expect(assertCertifiedActivePartner(deps, 'ally2')).rejects.toThrow('exclusiva de Aliados Certificados')
  })
  it('rechaza a un partner certificado pero inactivo', async () => {
    const deps = fakeDeps({ partners: [{ ...certifiedPartner, status: 'inactive' }] })
    await expect(assertCertifiedActivePartner(deps, 'ally1')).rejects.toThrow()
  })
  it('acepta a un Aliado Certificado activo', async () => {
    const deps = fakeDeps({ partners: [certifiedPartner] })
    await expect(assertCertifiedActivePartner(deps, 'ally1')).resolves.toBeTruthy()
  })
})

describe('assertReferredAndValidated — ownership real (#559)', () => {
  it('rechaza un hotelId que NO referenció este Aliado (nunca confiar en el hotelId del cliente)', async () => {
    const deps = fakeDeps({ referrals: [{ referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'validated' }] })
    await expect(assertReferredAndValidated(deps, 'ally1', 'h999-ajeno')).rejects.toThrow('red de referidos')
  })
  it('rechaza un referido que existe pero AÚN NO está validado (trial/active)', async () => {
    const deps = fakeDeps({ referrals: [{ referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'active' }] })
    await expect(assertReferredAndValidated(deps, 'ally1', 'h1')).rejects.toThrow()
  })
  it('rechaza un hotel referido por OTRO aliado (cross-tenant)', async () => {
    const deps = fakeDeps({ referrals: [{ referrerHotelId: 'ally-otro', referredHotelId: 'h1', status: 'validated' }] })
    await expect(assertReferredAndValidated(deps, 'ally1', 'h1')).rejects.toThrow()
  })
  it('acepta un referido validado del aliado correcto', async () => {
    const deps = fakeDeps({ referrals: [{ referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'validated' }] })
    await expect(assertReferredAndValidated(deps, 'ally1', 'h1')).resolves.toBeUndefined()
  })
})

describe('listMyReferredHotels (#559)', () => {
  it('lista solo los hoteles referidos y VALIDADOS, con nombre y conteo de fotos', async () => {
    const deps = fakeDeps({
      partners: [certifiedPartner],
      referrals: [
        { referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'validated' },
        { referrerHotelId: 'ally1', referredHotelId: 'h2', status: 'active' }, // aún no validado: no aparece
      ],
      hotels: { h1: { name: 'Hotel Mar', address: 'Calle 1', descriptionJson: null, latitude: 1, longitude: 2 } },
      media: [{ hotelId: 'h1' }, { hotelId: 'h1' }],
    })
    const result = await listMyReferredHotels(deps, 'ally1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ hotelId: 'h1', name: 'Hotel Mar', photoCount: 2 })
  })

  it('un Aliado normal (no certificado) no puede listar nada — 403 lógico', async () => {
    const deps = fakeDeps({ partners: [normalPartner] })
    await expect(listMyReferredHotels(deps, 'ally2')).rejects.toThrow()
  })
})

describe('updateReferredHotelBasics (#559)', () => {
  it('actualiza SOLO los campos permitidos de un hotel referido y validado', async () => {
    const deps = fakeDeps({
      partners: [certifiedPartner],
      referrals: [{ referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'validated' }],
      hotels: { h1: { name: 'Hotel Mar', address: 'Vieja', descriptionJson: null, latitude: 0, longitude: 0 } },
    })
    const result = await updateReferredHotelBasics(deps, 'ally1', 'h1', { address: 'Nueva 123' })
    expect(result.address).toBe('Nueva 123')
  })

  it('rechaza un campo fuera de la whitelist (ej. plan, status) aunque venga en el patch', async () => {
    const deps = fakeDeps({
      partners: [certifiedPartner],
      referrals: [{ referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'validated' }],
      hotels: { h1: { name: 'Hotel Mar' } },
    })
    await expect(updateReferredHotelBasics(deps, 'ally1', 'h1', { plan: 'enterprise' } as any)).rejects.toThrow('no editable')
  })

  it('rechaza editar un hotel que NO es un referido validado propio (cross-tenant)', async () => {
    const deps = fakeDeps({
      partners: [certifiedPartner],
      referrals: [{ referrerHotelId: 'ally-otro', referredHotelId: 'h1', status: 'validated' }],
      hotels: { h1: { name: 'Hotel Mar' } },
    })
    await expect(updateReferredHotelBasics(deps, 'ally1', 'h1', { address: 'x' })).rejects.toThrow()
  })

  it('rechaza un patch vacío ("nada para actualizar")', async () => {
    const deps = fakeDeps({
      partners: [certifiedPartner],
      referrals: [{ referrerHotelId: 'ally1', referredHotelId: 'h1', status: 'validated' }],
      hotels: { h1: { name: 'Hotel Mar' } },
    })
    await expect(updateReferredHotelBasics(deps, 'ally1', 'h1', {})).rejects.toThrow('Nada para actualizar')
  })
})
