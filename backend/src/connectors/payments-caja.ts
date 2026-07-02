// connectors/payments-caja.ts — Conector payments→caja.
// Cuando un pago cash se completa (onPaymentCompleted), registra un ingreso automático en caja.
// Así caja deja de ser módulo isla y concilia con los pagos reales del hotel.
// Dedup por paymentId dentro de CashService.registerPaymentIncome (no duplica en re-entradas).
// Best-effort: si caja no está disponible, no falla el módulo payments.

import type { ConnectorContext } from 'arckode-framework'

export function paymentsCajaConnector(ctx: ConnectorContext): void {
  const payments = ctx.resolveModule<{ setSockets: (s: any) => void }>('payments')

  payments.setSockets({
    onPaymentCompleted: async (payment: any) => {
      // Solo los pagos en efectivo impactan la caja física (tarjeta/transfer ya están bancarizados).
      if (payment.method !== 'cash') return
      try {
        const caja = ctx.resolveModule<{ registerPaymentIncome: (i: any) => Promise<any> }>('caja')
        await caja.registerPaymentIncome({
          hotelId: payment.hotelId,
          paymentId: payment.id,
          amount: payment.amount,
          method: 'cash',
          folioId: payment.folioId, // V23: PaymentDTO no tiene reservationId
          reference: payment.reference,
        })
      } catch {
        // Conector best-effort: no falla el módulo principal si caja no resuelve.
      }
    },
  })
}
