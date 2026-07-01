// facturas/usecases/billing.ts — Lógica de facturación pura (sin ORM, sin HTTP).
// Recibe RepositoryAdapter del dominio. Extraída del service para mantenerlo < 200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO } from '../types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Suma las tasas activas de la config fiscal del hotel (key 'taxes' o 'impuestos'). */
export async function taxRateFor(cfg: RepositoryAdapter<any>, hotelId: string): Promise<number> {
  try {
    let c = await cfg.findOne({ hotelId, key: 'taxes' })
    if (!c) c = await cfg.findOne({ hotelId, key: 'impuestos' })
    const arr: any[] = c?.value ?? []
    return arr.filter((t) => t && (t.activo ?? t.active)).reduce((s, t) => s + Number(t.tasa ?? t.rate ?? 0), 0) || 0
  } catch {
    return 0
  }
}

/** base = subtotal (neto) → devuelve impuesto y total. */
export function applyTax(base: number, rate: number): { tax: number; total: number } {
  const tax = round2((base * rate) / 100)
  return { tax, total: round2(base + tax) }
}

/** Construye el registro de factura/cargo/pago listo para persistir. */
export function buildInvoiceRecord(args: {
  hotelId: string
  type: string
  taxes: number
  amount: number
  invoiceNumber: string
  ncf: string | null
  dto: any
}): Omit<FacturasDTO, 'id'> {
  const { hotelId, type, taxes, amount, invoiceNumber, ncf, dto } = args
  return {
    hotelId,
    guestId: dto.guestId ?? null,
    reservationId: dto.reservationId ?? null,
    invoiceNumber,
    type,
    amount,
    taxes,
    currency: dto.currency ?? 'USD',
    status: dto.status ?? (type === 'invoice' ? 'pending' : type === 'payment' ? 'paid' : 'pending'),
    issueDate: dto.issueDate ?? new Date().toISOString().split('T')[0],
    dueDate: dto.dueDate ?? null,
    ncf,
    paymentMethod: dto.paymentMethod ?? null,
    notes: dto.notes ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any
}

export interface EnrichDeps {
  guest: RepositoryAdapter<any>
  reservation: RepositoryAdapter<any>
  room: RepositoryAdapter<any>
}

async function resolveGuest(repo: RepositoryAdapter<any>, id?: string | null): Promise<string> {
  if (!id) return ''
  try {
    const g = await repo.findById(id)
    return g?.name ?? ''
  } catch { return '' }
}

async function resolveRoom(deps: EnrichDeps, reservationId?: string | null): Promise<string> {
  if (!reservationId) return ''
  try {
    const r = await deps.reservation.findById(reservationId)
    if (!r?.roomId) return ''
    const rm = await deps.room.findById(r.roomId)
    return rm?.number ?? ''
  } catch { return '' }
}

/** Devuelve la factura con campos derivados (subtotal, taxRate, balance) y datos resueltos (guest, room). */
export async function enrichInvoice(r: FacturasDTO, deps: EnrichDeps): Promise<FacturasDTO> {
  const [guest, room] = await Promise.all([
    resolveGuest(deps.guest, r.guestId),
    resolveRoom(deps, r.reservationId),
  ])
  const taxes = Number(r.taxes) || 0
  const amount = Number(r.amount) || 0
  const amountPaid = Number(r.amountPaid) || 0
  const subtotal = round2(amount - taxes)
  const taxRate = subtotal > 0 ? round2((taxes / subtotal) * 100) : 0
  const balance = round2(amount - amountPaid)
  return { ...r, taxes, amount, amountPaid, subtotal, taxRate, balance, guest: guest || r.guest || '', room: room || r.room || '' }
}
