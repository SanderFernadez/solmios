// usuarios/tests/token-session.test.ts — G4: helpers de la sesión de refresh.

import { describe, it, expect } from 'bun:test'
import { decodeJwtPayload, jtiOf } from '../usecases/token-session'

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
