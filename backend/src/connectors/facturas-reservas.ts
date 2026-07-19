// connectors/facturas-reservas.ts — Conector entre módulos
// Cuando se paga una factura vinculada a una reserva, actualiza el estado de facturación de la reserva.
// Los conectores orquestan módulos SIN que estos se importen entre sí (regla del framework).

import type { ConnectorContext } from 'arckode-framework'

export function facturasReservasConnector(ctx: ConnectorContext): void {
  const facturas = ctx.resolveModule<{ setSockets: (s: any) => void }>('facturas')

  facturas.setSockets({
    onFacturasUpdated: async (factura: any) => {
      // Solo actuar si la factura tiene reserva vinculada y cambió a pagada
      if (!factura.reservationId || factura.status !== 'paid') return

      try {
        const reservas = ctx.resolveModule<{ update: (id: string, data: any) => Promise<any> }>('reservas')
        // BUG FIX: antes pisaba `notes` (cada factura pagada borraba cualquier nota previa del
        // huésped/habitación). Ahora appendea el aviso al final del notes existente.
        const prev = await (ctx as any).orm?.findById?.('Reservations', factura.reservationId)
        const prevNotes = String(prev?.notes ?? '').trim()
        const note = `Factura ${factura.invoiceNumber} pagada — $${factura.amount} ${factura.currency}`
        const notes = prevNotes ? `${prevNotes}\n${note}` : note
        await reservas.update(factura.reservationId, { notes } as any)
      } catch {
        // Conector es best-effort: no falla el módulo principal si la reserva no existe
      }
    },
  })
}
