// wallet-pass/tests/pass-email.test.ts — Tests del renderer + enqueue del email (F3 3.9).
// Cubre los acceptance del spec wallet-pass:
//   - HTML contiene botones Apple+Google cuando ambos URLs presentes.
//   - Sin appleUrl → no aparece botón Apple.
//   - Sin googleUrl → no aparece botón Google.
//   - lockCode SIEMPRE visible en mono font (es el fallback).
//   - Sin destinatario → 'skipped' (walk-in).
//   - EmailService lanza → 'failed' pero no propaga.
//
// Sin tocar EmailService real — mockea el .enqueue y el .logger.
import { describe, it, expect, mock } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { renderWalletPassEmail, sendWalletPassEmail } from '../usecases/pass-email'
import type { PassEmailInput } from '../usecases/pass-email'

const baseInput: PassEmailInput = {
  to: 'ana@test.com',
  hotelId: 'h1',
  reservationId: 'r1',
  hotelName: 'Hotel Test',
  guestName: 'Ana',
  checkIn: '2026-08-01',
  checkOut: '2026-08-05',
  roomNumber: '101',
  lockCode: 'TT-1234',
  appleUrl: 'https://apple.test/pass.pkpass',
  googleUrl: 'https://pay.google.com/gp/v/save/abc',
}

describe('wallet-pass/usecases/pass-email — F3 3.9', () => {
  describe('renderWalletPassEmail', () => {
    it('incluye AMBOS botones cuando ambos URLs están presentes', () => {
      const html = renderWalletPassEmail(baseInput)
      expect(html).toContain('Agregar a Apple Wallet')
      expect(html).toContain(baseInput.appleUrl!)
      expect(html).toContain('Agregar a Google Wallet')
      expect(html).toContain(baseInput.googleUrl!)
    })

    it('omite botón Apple cuando appleUrl es null', () => {
      const html = renderWalletPassEmail({ ...baseInput, appleUrl: null })
      expect(html).not.toContain('Agregar a Apple Wallet')
      expect(html).toContain('Agregar a Google Wallet')
    })

    it('omite botón Google cuando googleUrl es null', () => {
      const html = renderWalletPassEmail({ ...baseInput, googleUrl: null })
      expect(html).toContain('Agregar a Apple Wallet')
      expect(html).not.toContain('Agregar a Google Wallet')
    })

    it('omite AMBOS botones cuando ambos URLs son null (solo lockCode)', () => {
      const html = renderWalletPassEmail({ ...baseInput, appleUrl: null, googleUrl: null })
      expect(html).not.toContain('Agregar a Apple Wallet')
      expect(html).not.toContain('Agregar a Google Wallet')
    })

    it('lockCode SIEMPRE visible en mono font (fallback)', () => {
      // Sin URLs de pass → el lockCode sigue presente (es el fallback del spec).
      const html = renderWalletPassEmail({ ...baseInput, appleUrl: null, googleUrl: null })
      expect(html).toContain('TT-1234')
      expect(html).toContain('font-family:')
      expect(html).toContain('monospace')
    })

    it('escape HTML en hotelName y guestName (XSS-safe)', () => {
      const html = renderWalletPassEmail({
        ...baseInput,
        hotelName: '<script>x</script>',
        guestName: 'Ana & Bob',
      })
      expect(html).not.toContain('<script>x</script>')
      expect(html).toContain('&lt;script&gt;')
      expect(html).toContain('Ana &amp; Bob')
    })

    it('asunto incluye hotelName cuando se reemplaza el placeholder', () => {
      const subject = 'Tu pase de reserva + código de acceso — {hotel_name}'.replace('{hotel_name}', baseInput.hotelName)
      expect(subject).toBe('Tu pase de reserva + código de acceso — Hotel Test')
    })
  })

  describe('sendWalletPassEmail', () => {
    it('sin destinatario → skipped, no encola', async () => {
      const enqueue = mock(async () => 'q-1')
      const result = await sendWalletPassEmail(
        { emailService: { enqueue } as any, logger: silentLogger() },
        { ...baseInput, to: '' },
      )
      expect(result.status).toBe('skipped')
      expect(enqueue).not.toHaveBeenCalled()
    })

    it('happy path → encola con subject + html renderizado + relatedType wallet_pass', async () => {
      const enqueue = mock(async (input: any) => {
        expect(input.to).toBe('ana@test.com')
        expect(input.hotelId).toBe('h1')
        expect(input.subject).toContain('Hotel Test')
        expect(input.html).toContain('Agregar a Apple Wallet')
        expect(input.relatedType).toBe('wallet_pass')
        expect(input.relatedId).toBe('r1')
        return 'q-1'
      })
      const result = await sendWalletPassEmail(
        { emailService: { enqueue } as any, logger: silentLogger() },
        baseInput,
      )
      expect(result.status).toBe('sent')
      expect(enqueue).toHaveBeenCalledTimes(1)
    })

    it('enqueue falla → failed, no propaga', async () => {
      const enqueue = mock(async () => { throw new Error('SMTP down') })
      const result = await sendWalletPassEmail(
        { emailService: { enqueue } as any, logger: silentLogger() },
        baseInput,
      )
      expect(result.status).toBe('failed')
    })
  })
})
