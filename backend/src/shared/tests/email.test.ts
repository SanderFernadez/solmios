// El alta validaba el email con `includes('@')`, que acepta "a@" y "@b". Como el
// email ES la credencial de login, una dirección imposible deja una cuenta a la
// que nadie puede entrar ni recuperar.
import { describe, it, expect } from 'bun:test'
import { isValidEmail, normalizeEmail, EMAIL_MAX } from '../email'

describe('isValidEmail', () => {
  it('acepta direcciones normales', () => {
    for (const e of [
      'ana@hotel.com',
      'ana.perez@hotel.com.do',
      'ana+reservas@hotel.com',
      'a_b-c@sub.dominio.org',
      'recepcion@hotel-boutique.travel',
    ]) {
      expect(isValidEmail(e)).toBe(true)
    }
  })

  it('rechaza lo que el chequeo viejo dejaba pasar', () => {
    for (const e of ['a@', '@b', 'a@b', 'sin-arroba', 'a@b.', 'a@.com', 'a@@b.com']) {
      expect(isValidEmail(e)).toBe(false)
    }
  })

  it('rechaza espacios y separadores que rompen un envío', () => {
    for (const e of ['a b@hotel.com', 'a@ho tel.com', 'a,b@hotel.com', 'a;b@hotel.com', '<a@hotel.com>']) {
      expect(isValidEmail(e)).toBe(false)
    }
  })

  it('rechaza puntos consecutivos: no forman una etiqueta de dominio válida', () => {
    expect(isValidEmail('ana@hotel..com')).toBe(false)
  })

  it('exige un TLD de al menos dos letras', () => {
    expect(isValidEmail('ana@hotel.c')).toBe(false)
    expect(isValidEmail('ana@hotel.co')).toBe(true)
  })

  it('pone tope al largo (RFC 5321) y no explota con vacío/null', () => {
    expect(isValidEmail('a'.repeat(EMAIL_MAX) + '@hotel.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('recorta y baja a minúsculas: el login no distingue mayúsculas', () => {
    expect(normalizeEmail('  Ana@Hotel.COM ')).toBe('ana@hotel.com')
  })

  it('no explota con null ni undefined', () => {
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail(undefined)).toBe('')
  })
})
