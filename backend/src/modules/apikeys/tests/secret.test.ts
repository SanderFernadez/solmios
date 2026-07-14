// apikeys/tests/secret.test.ts — G5: el secreto lo genera el servidor, nunca se expone el hash.

import { describe, it, expect } from 'bun:test'
import { createHash } from 'crypto'
import { generateApiKey, stripSecret } from '../usecases/secret'

describe('apikeys secret — G5', () => {
  it('genera un secreto server-side con prefijo y alta entropía', () => {
    const k = generateApiKey()
    expect(k.plainKey).toMatch(/^sk_[A-Za-z0-9_-]{20,}$/)
  })

  it('el hash guardado es SHA-256 del plainKey (no el plainKey en claro)', () => {
    const k = generateApiKey()
    expect(k.secretHash).toBe(createHash('sha256').update(k.plainKey).digest('hex'))
    expect(k.secretHash).toMatch(/^[0-9a-f]{64}$/)
    expect(k.secretHash).not.toContain(k.plainKey)
  })

  it('masked muestra prefijo + cola, nunca el secreto entero', () => {
    const k = generateApiKey()
    expect(k.masked).toContain('•')
    expect(k.masked).not.toBe(k.plainKey)
  })

  it('cada key es única', () => {
    expect(generateApiKey().plainKey).not.toBe(generateApiKey().plainKey)
  })

  it('stripSecret quita secretHash de una lectura', () => {
    const out = stripSecret({ id: '1', name: 'x', secretHash: 'abc', masked: 'sk_••1234' })
    expect(out).not.toHaveProperty('secretHash')
    expect(out).toMatchObject({ id: '1', name: 'x', masked: 'sk_••1234' })
  })
})
