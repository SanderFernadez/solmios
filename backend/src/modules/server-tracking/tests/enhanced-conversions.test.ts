// server-tracking/tests/enhanced-conversions.test.ts — F3 3.11 hash SHA256 (spec.md "Hash correcto").
//
// Cubre:
//  - normalizeEmail: trim + lowercase.
//  - normalizePhone: saca todo lo que no sea dígito (espacios, '+', '()', '-').
//  - hashSha256: hex lowercase 64 chars, sin espacios.
//  - hashEmail/hashPhone: composición de los dos.
//  - Vacíos / null → null (no se manda hasheado vacío a Meta).
//
// Vector de referencia (spec.md scenario "Hash correcto"):
//   email='Juan.Perez@Example.com' → 'juan.perez@example.com' → SHA256 conocido.
//   phone='+1 809 555 0000' → '18095550000' → SHA256 conocido.
import { describe, it, expect } from 'bun:test'
import {
  hashSha256, normalizeEmail, normalizePhone, hashEmail, hashPhone,
} from '../usecases/enhanced-conversions'

describe('F3 3.11 — Enhanced Conversions (hash SHA256)', () => {
  describe('normalizeEmail', () => {
    it('trim + lowercase', () => {
      expect(normalizeEmail('Juan.Perez@Example.com')).toBe('juan.perez@example.com')
      expect(normalizeEmail('  Foo@BAR.com \n')).toBe('foo@bar.com')
    })
    it('null/undefined/vacío → string vacía', () => {
      expect(normalizeEmail(null)).toBe('')
      expect(normalizeEmail(undefined)).toBe('')
      expect(normalizeEmail('   ')).toBe('')
    })
  })

  describe('normalizePhone', () => {
    it('saca +, espacios, guiones, paréntesis', () => {
      expect(normalizePhone('+1 809 555 0000')).toBe('18095550000')
      expect(normalizePhone('+1 (809) 555-0000')).toBe('18095550000')
      expect(normalizePhone('  +54 11 1234-5678  ')).toBe('541112345678')
    })
    it('null/undefined → string vacía', () => {
      expect(normalizePhone(null)).toBe('')
      expect(normalizePhone(undefined)).toBe('')
      expect(normalizePhone('-------')).toBe('')
    })
  })

  describe('hashSha256', () => {
    it('devuelve hex lowercase de 64 chars sin espacios', async () => {
      const h = await hashSha256('juan.perez@example.com')
      expect(h).toMatch(/^[0-9a-f]{64}$/)
      expect(h).toBe(h!.toLowerCase())
      expect(h).not.toMatch(/\s/)
    })
    it('es determinista — mismo input → mismo hash', async () => {
      const a = await hashSha256('test@example.com')
      const b = await hashSha256('test@example.com')
      expect(a).toBe(b)
    })
    it('vector conocido: sha256("hello") = 2cf24dba...', async () => {
      // Vector estándar NIST: sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      expect(await hashSha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    })
    it('null/undefined/vacío → null', async () => {
      expect(await hashSha256(null)).toBeNull()
      expect(await hashSha256(undefined)).toBeNull()
      expect(await hashSha256('')).toBeNull()
      expect(await hashSha256('   ')).toBeNull()
    })
  })

  describe('hashEmail', () => {
    it('compone normalize + hash (spec.md scenario "Hash correcto")', async () => {
      // 'Juan.Perez@Example.com' → normalize → 'juan.perez@example.com' → hash
      const em = await hashEmail('Juan.Perez@Example.com')
      expect(em).toMatch(/^[0-9a-f]{64}$/)
      // Igual al hash del valor ya normalizado:
      expect(em).toBe(await hashSha256('juan.perez@example.com'))
    })
    it('vacío → null', async () => {
      expect(await hashEmail('')).toBeNull()
      expect(await hashEmail(null)).toBeNull()
    })
  })

  describe('hashPhone', () => {
    it('compone normalize + hash (spec.md scenario "Hash correcto")', async () => {
      const ph = await hashPhone('+1 809 555 0000')
      expect(ph).toMatch(/^[0-9a-f]{64}$/)
      expect(ph).toBe(await hashSha256('18095550000'))
    })
    it('string sin dígitos → null', async () => {
      expect(await hashPhone('-------')).toBeNull()
      expect(await hashPhone('')).toBeNull()
    })
  })
})
