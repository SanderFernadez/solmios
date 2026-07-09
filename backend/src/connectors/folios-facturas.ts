// connectors/folios-facturas.ts — Conector entre módulos
// Le da a `folios` la capacidad de emitir la factura al cerrar (POST /api/folios/:id/invoice)
// sin importar el módulo `facturas`: folios declara el puerto (FolioInvoicingPort) y acá se
// inyecta la implementación. Antes esta orquestación vivía en el frontend, que hacía dos
// requests y dejaba el folio cerrado sin factura si la segunda fallaba.

import type { ConnectorContext } from 'arckode-framework'

interface FacturasModule {
  create: (dto: Record<string, unknown>, user: unknown) => Promise<{ id: string; invoiceNumber?: string }>
}

export function foliosFacturasConnector(ctx: ConnectorContext): void {
  const folios = ctx.resolveModule<{ setInvoicingDeps: (p: any) => void }>('folios')
  const facturas = ctx.resolveModule<FacturasModule>('facturas')

  folios.setInvoicingDeps({
    createInvoice: async (invoiceData: any, user: any) =>
      facturas.create({
        hotelId: invoiceData.hotelId,
        guestId: invoiceData.guestId || undefined,
        reservationId: invoiceData.reservationId || undefined,
        type: invoiceData.type,
        amount: invoiceData.amount,
        status: invoiceData.status,
        notes: invoiceData.notes,
        items: invoiceData.items,
        // Los pagos posteados al folio ya asentaron dinero en `payments`: la factura los hereda
        // en vez de volver a cobrarse.
        amountPaid: invoiceData.amountPaid,
      }, user),
  })
}
