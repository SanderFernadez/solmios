// usuarios/tests/token-session.test.ts — G4: helpers de la sesión de refresh.

import { describe, it, expect } from 'bun:test'
import { decodeJwtPayload, jtiOf, refreshSession } from '../usecases/token-session'

// JWT real de ejemplo: header.payload.signature con { "jti":"abc-123", "id":"u1" } en el payload.
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.fakesig`
}

describe('token-session — G4', () => {
  it('decodeJwtPayload lee el payload sin verificar la firma', () => {
    const t = makeJwt({ id: 'u1', jti: 'abc-123', type: 'refresh' })
    expect(decodeJwtPayload(t)).toMatchObject({ id: 'u1', jti: 'abc-123' })
  })

  it('jtiOf extrae el jti', () => {
    expect(jtiOf(makeJwt({ jti: 'xyz-789' }))).toBe('xyz-789')
  })

  it('jtiOf devuelve undefined si no hay jti', () => {
    expect(jtiOf(makeJwt({ id: 'u1' }))).toBeUndefined()
  })

  it('no explota con basura', () => {
    expect(decodeJwtPayload('no-es-un-jwt')).toEqual({})
    expect(jtiOf('')).toBeUndefined()
  })
})

describe('refreshSession — gate de suscripción en una sesión ya activa (PLAN-SUSCRIPCIONES.md §5/#542)', () => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const makeJwt = (payload: Record<string, unknown>) => `${b64({ alg: 'HS256' })}.${b64(payload)}.fakesig`

  function makeRepo(user: any) {
    const updates: Array<{ id: string; patch: any }> = []
    return {
      updates,
      repo: {
        findById: async (id: string) => (id === user.id ? user : null),
        update: async (id: string, patch: any) => { updates.push({ id, patch }); return { id, ...patch } },
      },
    }
  }
  const fakeAuth = { refresh: () => ({ accessToken: 'new-access', refreshToken: makeJwt({ id: 'u1', jti: 'jti-2', type: 'refresh' }) }) }

  it('hotel con suscripción al día: renueva normalmente', async () => {
    const user = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', token: 'jti-1' }
    const { repo, updates } = makeRepo(user)
    const rt = makeJwt({ id: 'u1', jti: 'jti-1', type: 'refresh' })

    const result = await refreshSession(repo, fakeAuth, rt, () => { throw new Error('no debería invalidar') },
      async () => {}) // assertCanOperate que no tira = "todo bien"

    expect(result.token).toBe('new-access')
    expect(updates).toHaveLength(1)
  })

  it('hotel suspendido: el refresh NO renueva — corta una sesión ya logueada, no solo el próximo login', async () => {
    const user = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', token: 'jti-1' }
    const { repo, updates } = makeRepo(user)
    const rt = makeJwt({ id: 'u1', jti: 'jti-1', type: 'refresh' })
    const assertCanOperate = async () => { throw new Error('Tu suscripción está suspendida por falta de pago.') }

    await expect(refreshSession(repo, fakeAuth, rt, () => { throw new Error('jti inválido, no es este caso') }, assertCanOperate))
      .rejects.toThrow('suspendida')
    expect(updates).toHaveLength(0) // no rota el jti: la sesión sigue exactamente como estaba, bloqueada
  })

  it('jti inválido se revisa ANTES que la suscripción: no gasta la consulta si el token ya está revocado', async () => {
    const user = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', token: 'jti-VIEJO' }
    const { repo } = makeRepo(user)
    const rt = makeJwt({ id: 'u1', jti: 'jti-presentado-no-coincide', type: 'refresh' })
    let subscriptionChecked = false
    const assertCanOperate = async () => { subscriptionChecked = true }

    await expect(refreshSession(repo, fakeAuth, rt, () => { throw new Error('Sesión expirada') }, assertCanOperate))
      .rejects.toThrow('Sesión expirada')
    expect(subscriptionChecked).toBe(false)
  })

  it('sin assertCanOperate inyectado: no bloquea nada (mismo criterio best-effort que assertHotelCanOperate en login)', async () => {
    const user = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', token: 'jti-1' }
    const { repo, updates } = makeRepo(user)
    const rt = makeJwt({ id: 'u1', jti: 'jti-1', type: 'refresh' })

    const result = await refreshSession(repo, fakeAuth, rt, () => { throw new Error('no debería invalidar') })

    expect(result.token).toBe('new-access')
    expect(updates).toHaveLength(1)
  })
})
