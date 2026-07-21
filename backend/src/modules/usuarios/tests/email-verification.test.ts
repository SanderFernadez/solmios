// email-verification.test.ts — #421: token de verificación de email (hash, vencimiento, un solo uso).
import { describe, it, expect } from 'bun:test'
import { hashToken, newVerificationToken, verifyEmailToken, type VerificationUser } from '../usecases/email-verification'

const NOW = Date.parse('2026-07-21T12:00:00Z')

function makeRepo(users: VerificationUser[]) {
  const updates: Array<{ id: string; patch: any }> = []
  return {
    repo: {
      findOne: async (f: any) => users.find((u) => u.emailVerificationToken === f.emailVerificationToken) ?? null,
      update: async (id: string, patch: any) => { updates.push({ id, patch }); const u = users.find((x) => x.id === id); if (u) Object.assign(u, patch); return u },
    } as any,
    updates,
  }
}

describe('newVerificationToken', () => {
  it('el token va en claro pero se guarda su hash (no coinciden)', () => {
    const v = newVerificationToken(NOW)
    expect(v.token).toMatch(/^[0-9a-f]{64}$/)
    expect(v.tokenHash).toBe(hashToken(v.token))
    expect(v.tokenHash).not.toBe(v.token)
    expect(v.expires).toBe(NOW + 24 * 60 * 60 * 1000)
  })
})

describe('verifyEmailToken', () => {
  it('token válido → marca verificado y limpia el token (un solo uso)', async () => {
    const v = newVerificationToken(NOW)
    const { repo, updates } = makeRepo([{ id: 'u1', email: 'a@b.com', emailVerificationToken: v.tokenHash, emailVerificationExpires: v.expires }])
    expect(await verifyEmailToken(repo, v.token, NOW + 1000)).toBe('verified')
    expect(updates[0].patch.emailVerifiedAt).toBeTruthy()
    expect(updates[0].patch.emailVerificationToken).toBeNull()   // no reutilizable
  })

  it('token vencido → expired, no marca verificado', async () => {
    const v = newVerificationToken(NOW)
    const { repo, updates } = makeRepo([{ id: 'u1', emailVerificationToken: v.tokenHash, emailVerificationExpires: v.expires }])
    expect(await verifyEmailToken(repo, v.token, v.expires + 1)).toBe('expired')
    expect(updates).toHaveLength(0)
  })

  it('token ya usado (verificado) → already_verified', async () => {
    const v = newVerificationToken(NOW)
    const { repo } = makeRepo([{ id: 'u1', emailVerifiedAt: '2026-07-01T00:00:00Z', emailVerificationToken: v.tokenHash, emailVerificationExpires: v.expires }])
    expect(await verifyEmailToken(repo, v.token, NOW)).toBe('already_verified')
  })

  it('token inexistente / de otro → invalid, sin revelar nada', async () => {
    const { repo } = makeRepo([{ id: 'u1', emailVerificationToken: hashToken('otro-token'), emailVerificationExpires: NOW + 1000 }])
    expect(await verifyEmailToken(repo, 'token-que-no-existe', NOW)).toBe('invalid')
  })

  it('token vacío → invalid', async () => {
    const { repo } = makeRepo([])
    expect(await verifyEmailToken(repo, '', NOW)).toBe('invalid')
  })
})
