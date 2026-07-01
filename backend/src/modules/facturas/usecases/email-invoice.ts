// facturas/usecases/email-invoice.ts — Stub de envío de factura por email.
// La implementación real requiere credenciales SMTP/API configuradas en el hotel.
// Por ahora, genera el HTML y loggea la intención de envío.

import type { FacturasDTO } from '../types'
import { renderInvoiceHtml, type InvoiceTemplateData } from './invoice-template'

export interface EmailInvoiceResult {
  sent: boolean
  to: string
  subject: string
  message: string
}

/**
 * Prepara el envío de una factura por email.
 * Stub: genera el contenido pero no envía (falta configurar SMTP/API).
 * Retorna el resultado para que el frontend muestre feedback.
 */
export async function sendInvoiceByEmail(
  invoice: FacturasDTO,
  recipientEmail: string,
  templateData: Omit<InvoiceTemplateData, 'invoice'>,
  logger: { info: (msg: string, ctx?: any) => void },
): Promise<EmailInvoiceResult> {
  const html = renderInvoiceHtml({ invoice, ...templateData })
  const subject = `Factura ${invoice.invoiceNumber} — ${templateData.hotelName || 'Hotel'}`

  // Stub: loggear en lugar de enviar
  logger.info('Email factura (stub)', {
    to: recipientEmail,
    subject,
    invoiceNumber: invoice.invoiceNumber,
    htmlLength: html.length,
  })

  // TODO: Integrar con servicio de email cuando el hotel configure SMTP/API
  // await emailService.send({ to: recipientEmail, subject, html })

  return {
    sent: false,
    to: recipientEmail,
    subject,
    message: `Factura ${invoice.invoiceNumber} preparada para envío a ${recipientEmail}. Configurar SMTP/API para envío real.`,
  }
}
