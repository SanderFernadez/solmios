// facturas/usecases/email-invoice.ts — Envío de factura por email.
// Delega al EmailService.transaccional (cola persistente + reintentos con backoff + SMTP/Resend).
// Usa un puerto mínimo (InvoiceEmailPort) por duck typing — no acopla al service concreto ni
// al puerto EmailSender (orientado a eventos). EmailService.enqueue cumple este contrato.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO } from '../types'
import { renderInvoiceHtml } from './invoice-template'

export interface EmailInvoiceResult {
  sent: boolean
  to: string
  subject: string
  messageId: string
  configured: boolean
}

/** Puerto mínimo: lo único que facturas necesita del EmailService. EmailService lo cumple. */
export interface InvoiceEmailPort {
  enqueue(input: { to: string; subject: string; html: string; hotelId: string }): Promise<string>
  /** ¿El hotel tiene SMTP o Resend configurado? Si no, el email se encolaría pero nunca se entregaría. */
  isConfigured(hotelId: string): Promise<boolean>
}

const TYPE_LABEL: Record<string, string> = {
  invoice: 'Factura', credit_note: 'Nota de crédito', receipt: 'Recibo', folio: 'Cargo', payment: 'Comprobante de pago',
}

/** Encola el envío de una factura por email. Resuelve el nombre del hotel para el asunto/template. */
export async function sendInvoiceByEmail(args: {
  invoice: FacturasDTO
  to: string
  hotelRepo?: RepositoryAdapter<any>
  emailPort: InvoiceEmailPort
}): Promise<EmailInvoiceResult> {
  const { invoice, to, hotelRepo, emailPort } = args

  let hotelName = 'Hotel'
  if (hotelRepo && invoice.hotelId) {
    try {
      const hotel = await hotelRepo.findById(invoice.hotelId)
      if (hotel?.name) hotelName = hotel.name
    } catch { /* nombre por defecto */ }
  }

  const html = renderInvoiceHtml({ invoice, hotelName })
  const subject = `${TYPE_LABEL[invoice.type] ?? 'Documento'} ${invoice.invoiceNumber} — ${hotelName}`
  const messageId = await emailPort.enqueue({ to, subject, html, hotelId: invoice.hotelId })

  return { sent: true, to, subject, messageId, configured: true }
}
