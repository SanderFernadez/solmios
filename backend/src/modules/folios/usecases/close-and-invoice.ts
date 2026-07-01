// folios/usecases/close-and-invoice.ts — Cierra folio y prepara datos para factura.
// Extraído del service para mantenerlo < 200 líneas.

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import type { FolioDTO, FolioChargeDTO, CurrentUser } from '../types'
import { computeTotals } from './folio-math'

export interface CloseAndInvoiceDeps {
  folioRepo: RepositoryAdapter<FolioDTO>
  chargeRepo: RepositoryAdapter<FolioChargeDTO>
  guestRepo: RepositoryAdapter<any>
  roomRepo: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export interface InvoiceLineItem {
  description: string
  amount: number
}

export interface CloseAndInvoiceResult {
  folio: FolioDTO
  invoiceData: {
    hotelId: string
    guestId: string | null
    reservationId: string | null
    type: string
    amount: number
    status: string
    notes: string
    items: InvoiceLineItem[]
  }
}

export async function closeAndInvoice(
  deps: CloseAndInvoiceDeps,
  folioId: string,
  user: CurrentUser,
): Promise<CloseAndInvoiceResult> {
  const folio = await deps.folioRepo.findById(folioId)
  if (!folio) throw new Error('Folio no encontrado')

  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
  if (folio.status !== 'open') throw new Error('El folio no está abierto')

  // Obtener cargos y calcular totales
  const charges = (await deps.chargeRepo.findMany({ folioId })) as FolioChargeDTO[]
  const totals = computeTotals(charges)
  const taxCharges = charges.filter(c => c.kind === 'charge')
  const taxes = taxCharges.reduce((s, c) => s + Number(c.taxes || 0), 0)
  const subtotal = totals.chargesTotal - taxes

  // Construir líneas de la factura desde los cargos
  const items: InvoiceLineItem[] = taxCharges.map(c => ({
    description: c.description || c.category,
    amount: Number(c.total) || 0,
  }))

  // Obtener datos del huésped y habitación
  const guest = folio.guestId ? await deps.guestRepo.findById(folio.guestId) : null
  const room = folio.roomId ? await deps.roomRepo.findById(folio.roomId) : null
  const guestName = (guest as any)?.name || 'Cliente General'
  const roomNumber = (room as any)?.number || ''

  // Cerrar el folio
  const now = new Date().toISOString()
  const closed = await deps.folioRepo.update(folioId, { status: 'closed', closedAt: now } as any)

  // Preparar datos de la factura
  const invoiceData = {
    hotelId: folio.hotelId,
    guestId: folio.guestId,
    reservationId: folio.reservationId,
    type: 'invoice',
    amount: subtotal,
    status: 'pending',
    notes: `Folio ${folioId.slice(0, 8)} · ${items.length} cargo(s) · ${guestName}${roomNumber ? ` · Hab ${roomNumber}` : ''}`,
    items,
  }

  return { folio: closed as FolioDTO, invoiceData }
}
