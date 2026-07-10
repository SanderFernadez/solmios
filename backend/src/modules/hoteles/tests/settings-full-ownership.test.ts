// hoteles/tests/settings-full-ownership.test.ts — Contrato de assertOwnership en GET /api/settings/full.
//
// Regresión: `SettingsFullUseCase.execute` llamaba `auth.assertOwnership(hotel, user)` con dos objetos,
// donde el framework espera `(dueño: string, solicitante: string, rol?, rolAdmin?)`. Comparar objeto
// contra objeto nunca da true y el rol llegaba `undefined`, así que lanzaba Forbidden SIEMPRE: la
// pantalla de configuración completa del hotel no cargaba para nadie, ni para el super_admin.
//
// El tipo del parámetro `auth` declaraba la firma equivocada, así que el typecheck tampoco lo veía.
// Acá se instancia el `Auth` REAL: si la firma vuelve a romperse, esto falla.
//
// Importa además porque `?hotelId=` pisa al hotel del token (controller.resolveHotel): este
// assertOwnership es la única defensa entre un hotel y la configuración de otro.

import { describe, it, expect } from 'bun:test'
import { Auth } from 'arckode-framework'
import { SettingsFullUseCase } from '../usecases/settings-full'

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any
const fakeJwt = { sign: () => '', verify: () => ({}) } as any
const realAuth = new Auth(fakeJwt, 'test-secret', noopLogger)

const HOTEL = 'hotel-a'
const OTRO_HOTEL = 'hotel-b'

const orm = {
  findById: async (_model: string, id: string) => (id === HOTEL ? { id: HOTEL, name: 'Hotel A' } : null),
  findMany: async (model: string) => (model === 'Rooms' ? [{ type: 'suite' }] : []),
} as any

const usecase = new SettingsFullUseCase(orm)
const user = (over: Record<string, any> = {}) => ({ id: 'u1', role: 'hotel_admin', hotelId: HOTEL, ...over })

describe('SettingsFullUseCase — con el Auth real', () => {
  it('deja pasar al usuario del mismo hotel', async () => {
    const out = await usecase.execute(HOTEL, realAuth, user())
    expect(out.hotel.id).toBe(HOTEL)
    expect(out.roomTypes).toEqual(['suite'])
  })

  it('deja pasar al super_admin de otro hotel', async () => {
    const out = await usecase.execute(HOTEL, realAuth, user({ role: 'super_admin', hotelId: OTRO_HOTEL }))
    expect(out.hotel.id).toBe(HOTEL)
  })

  it('bloquea al usuario de otro hotel', async () => {
    const call = usecase.execute(HOTEL, realAuth, user({ hotelId: OTRO_HOTEL }))
    await expect(call).rejects.toThrow(/Forbidden/)
  })

  it('sigue funcionando sin auth ni user (llamada interna)', async () => {
    const out = await usecase.execute(HOTEL)
    expect(out.hotel.id).toBe(HOTEL)
  })

  it('lanza NotFound si el hotel no existe', async () => {
    await expect(usecase.execute('no-existe', realAuth, user())).rejects.toThrow(/no encontrado/i)
  })
})
