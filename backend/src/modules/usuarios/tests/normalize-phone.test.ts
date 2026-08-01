// usuarios/tests/normalize-phone.test.ts
// El login por teléfono fallaba con `+1 809 555 0001`: se limpiaba el `+` pero no el
// código de país, así que `18095550001` nunca coincidía con `8095550001` de la base.

import { describe, it, expect } from 'bun:test'
import { normalizePhone, looksLikePhone, toStoredPhone } from '../usecases/normalize-phone'

describe('normalizePhone', () => {
  it('reduce a dígitos los formatos que ya funcionaban', () => {
    expect(normalizePhone('8095550001')).toBe('8095550001')
    expect(normalizePhone('809-555-0001')).toBe('8095550001')
    expect(normalizePhone('809 555 0001')).toBe('8095550001')
    expect(normalizePhone('(809) 555-0001')).toBe('8095550001')
  })

  it('descarta el código de país NANP — el bug reportado', () => {
    expect(normalizePhone('+18095550001')).toBe('8095550001')
    expect(normalizePhone('+1 809 555 0001')).toBe('8095550001')
    expect(normalizePhone('18095550001')).toBe('8095550001')
    expect(normalizePhone('+1 (809) 555-0001')).toBe('8095550001')
  })

  it('lo escrito por el usuario coincide con lo guardado en la base', () => {
    const enLaBase = '809-555-0001'
    for (const escrito of ['+1 809 555 0001', '18095550001', '(809) 555-0001', '8095550001']) {
      expect(normalizePhone(escrito)).toBe(normalizePhone(enLaBase))
    }
  })

  it('no toca un número de 10 dígitos que arranca en 1', () => {
    // 1809555000 son 10 dígitos: es el número completo, no lleva código de país.
    expect(normalizePhone('1809555000')).toBe('1809555000')
  })

  it('no toca números que no son NANP', () => {
    expect(normalizePhone('+34 600 123 456')).toBe('34600123456')
    expect(normalizePhone('5215512345678')).toBe('5215512345678')
  })

  it('devuelve cadena vacía cuando no hay dígitos', () => {
    expect(normalizePhone('+')).toBe('')
    expect(normalizePhone('()- ')).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})

describe('looksLikePhone', () => {
  it('reconoce teléfonos en cualquier formato', () => {
    expect(looksLikePhone('8095550001')).toBe(true)
    expect(looksLikePhone('+1 809 555 0001')).toBe(true)
    expect(looksLikePhone('(809) 555-0001')).toBe(true)
  })

  it('un email nunca es teléfono', () => {
    expect(looksLikePhone('rosa@solmios.com')).toBe(false)
    expect(looksLikePhone('admin@managerhotel.com')).toBe(false)
  })
})

describe('toStoredPhone', () => {
  it('persiste dígitos planos, venga como venga', () => {
    for (const escrito of ['809-555-0001', '(809) 555-0001', '+1 809 555 0001', ' 8095550001 ']) {
      expect(toStoredPhone(escrito)).toEqual({ phone: '8095550001' })
    }
  })

  it('no devuelve la clave si no vino el campo — un update parcial no borra el teléfono', () => {
    expect(toStoredPhone(undefined)).toEqual({})
    expect(toStoredPhone(null)).toEqual({})
  })

  it('permite borrar el teléfono explícitamente con cadena vacía', () => {
    expect(toStoredPhone('')).toEqual({ phone: '' })
    expect(toStoredPhone('   ')).toEqual({ phone: '' })
  })

  it('es idempotente: normalizar lo ya normalizado no cambia nada', () => {
    const once = toStoredPhone('+1 809 555 0001')
    expect(toStoredPhone(once.phone)).toEqual(once)
  })

  // #582: delimitar — un teléfono fuera del rango E.164 (7-15 dígitos) no debe persistirse. El
  // feedback reportó "77777777777777777777777777" (26 dígitos) aceptado en /panel/empleados, que
  // "puede causar error en la db".
  it('rechaza un teléfono con más de 15 dígitos (el caso del feedback: 26 dígitos)', () => {
    expect(() => toStoredPhone('77777777777777777777777777')).toThrow(/Teléfono inválido/)
    expect(() => toStoredPhone('+1 809 555 0001 999 888')).toThrow(/Teléfono inválido/)
  })

  it('rechaza un teléfono con menos de 7 dígitos', () => {
    expect(() => toStoredPhone('12345')).toThrow(/Teléfono inválido/)
    expect(() => toStoredPhone('+1 23')).toThrow(/Teléfono inválido/)
  })

  it('acepta los límites del rango E.164 (7 y 15) e internacionales', () => {
    expect(toStoredPhone('1234567')).toEqual({ phone: '1234567' })                // 7 (mín)
    expect(toStoredPhone('5215512345678')).toEqual({ phone: '5215512345678' })    // 13 (MX)
    expect(toStoredPhone('346001234561234')).toEqual({ phone: '346001234561234' }) // 15 (máx)
  })

  it('sigue permitiendo vacío/undefined (campo opcional) sin lanzar', () => {
    expect(toStoredPhone('')).toEqual({ phone: '' })
    expect(toStoredPhone(undefined)).toEqual({})
  })
})
