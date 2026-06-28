// services/guest-language.test.ts — Tests de resolveGuestLanguage (spec 11.1.6).

import { describe, it, expect } from 'bun:test'
import { resolveGuestLanguage } from './guest-language'

describe('resolveGuestLanguage (spec 11.1.6)', () => {
  it('language explícita tiene prioridad sobre nationality', () => {
    expect(resolveGuestLanguage({ language: 'en', nationality: 'Argentina' })).toBe('en')
    expect(resolveGuestLanguage({ language: 'Português' })).toBe('pt')
  })

  it('inferencia por nombre de país', () => {
    expect(resolveGuestLanguage({ nationality: 'Argentina' })).toBe('es')
    expect(resolveGuestLanguage({ nationality: 'United States' })).toBe('en')
    expect(resolveGuestLanguage({ nationality: 'Brasil' })).toBe('pt')
    expect(resolveGuestLanguage({ nationality: 'España' })).toBe('es')
  })

  it('inferencia por código ISO', () => {
    expect(resolveGuestLanguage({ nationality: 'MX' })).toBe('es')
    expect(resolveGuestLanguage({ nationality: 'US' })).toBe('en')
    expect(resolveGuestLanguage({ nationality: 'BR' })).toBe('pt')
    expect(resolveGuestLanguage({ nationality: 'GB' })).toBe('en')
  })

  it('nationality desconocida → default es', () => {
    expect(resolveGuestLanguage({ nationality: 'Japan' })).toBe('es')
    expect(resolveGuestLanguage({ nationality: 'JP' })).toBe('es')
  })

  it('sin datos → default es', () => {
    expect(resolveGuestLanguage({})).toBe('es')
    expect(resolveGuestLanguage({ language: null, nationality: null })).toBe('es')
  })
})
