// abandon-recovery/tests/template.test.ts — Tests del builder del link + email HTML (F3 3.14).
import { describe, it, expect } from 'bun:test'
import { buildRecoveryLink, renderAbandonEmailHtml, emailSubject } from '../usecases/template'

describe('buildRecoveryLink', () => {
  it('arma el link completo cuando base + slug están presentes', () => {
    const link = buildRecoveryLink('https://hotel.com/', 'mar-del-plata', 'r-123', 'tok-abc')
    expect(link).toBe('https://hotel.com/book/mar-del-plata?reservation=r-123&token=tok-abc')
  })

  it('sin slash final en base también funciona', () => {
    const link = buildRecoveryLink('https://hotel.com', 'slug', 'r', 't')
    expect(link).toBe('https://hotel.com/book/slug?reservation=r&token=t')
  })

  it('sin slug apunta a /book genérico', () => {
    const link = buildRecoveryLink('https://hotel.com', '', 'r', 't')
    expect(link).toBe('https://hotel.com/book?reservation=r&token=t')
  })

  it('sin base usa path relativo (mejor que nada)', () => {
    const link = buildRecoveryLink('', 'slug', 'r', 't')
    expect(link).toBe('/book/slug?reservation=r&token=t')
  })

  it('escapa caracteres especiales en el token (XSS-safe en href)', () => {
    const link = buildRecoveryLink('https://h.com', 's', 'r', 'a&b<c>"')
    // El href del HTML va por escapeHtml; el link crudo conserva los chars (es URL-encoded).
    expect(link).toContain('token=a%26b%3Cc%3E%22')
  })
})

describe('renderAbandonEmailHtml', () => {
  it('incluye el link escapado en el href del CTA', () => {
    const html = renderAbandonEmailHtml({ link: 'https://x.com?token=a&b', reservationId: 'r1' })
    expect(html).toContain('href="https://x.com?token=a&amp;b"')
    expect(html).toContain('Completar mi reserva')
  })

  it('es HTML válido (doctype + meta + body)', () => {
    const html = renderAbandonEmailHtml({ link: 'x', reservationId: 'r1' })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('</body></html>')
  })
})

describe('emailSubject', () => {
  it('devuelve un subject no vacío', () => {
    expect(emailSubject().length).toBeGreaterThan(10)
    expect(emailSubject()).toContain('reserva')
  })
})
