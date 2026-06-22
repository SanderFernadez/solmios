// facturas/service.ts — Casos de uso de facturación del hotel.
// Delega la lógica pura a ./usecases/billing.ts para mantenerse < 200 líneas.
// Recibe RepositoryAdapter<T> (no ORM directo — REGLA #18). Verifica ownership (REGLA #9).
//
// Modelo de dinero: `amount` = TOTAL (subtotal + impuestos). Al emitir una factura,
// dto.amount se interpreta como SUBTOTAL (base neta) y el service calcula el impuesto.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type {
  FacturasDTO, CreateFacturasDTO, UpdateFacturasDTO, PayFacturasDTO,
  FacturasQuery, FacturasListResult, CurrentUser,
} from './types'
import type { FacturasSockets } from './sockets'
import { taxRateFor, applyTax, buildInvoiceRecord, enrichInvoice, type EnrichDeps } from './usecases/billing'

export class FacturasService {
  private sockets: FacturasSockets = {}
  private readonly enrichDeps: EnrichDeps

  constructor(
    private readonly repo: RepositoryAdapter<FacturasDTO>,
    private readonly configRepo: RepositoryAdapter<any>,
    deps: EnrichDeps,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {
    this.enrichDeps = deps
  }

  setSockets(s: Partial<FacturasSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // ─── Lectura ──────────────────────────────────────────────────
  async list(query?: FacturasQuery, user?: CurrentUser): Promise<FacturasListResult> {
    this.logger.info('Listando facturas', { query })
    const filters: Record<string, unknown> = {}
    if (query?.type) filters.type = query.type
    if (query?.status) filters.status = query.status

    // Multi-tenancy
    if (user && user.role !== 'super_admin') {
      if (!user.hotelId) throw new AuthError('No hotel assigned')
      filters.hotelId = user.hotelId
    } else if (query?.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query?.page || 1, 1)
    const limit = Math.min(Math.max(query?.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const cacheKey = `facturas:list:${user?.hotelId || 'all'}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as FacturasListResult

    const result = await this.repo.paginate(filters, { offset, limit })
    const data = await Promise.all(result.data.map((r) => enrichInvoice(r, this.enrichDeps)))
    const response = { data, total: result.total }

    let finalResult = response
    if (query?.search) {
      const q = String(query.search).toLowerCase()
      const filtered = data.filter((d) =>
        (d.invoiceNumber || '').toLowerCase().includes(q) ||
        (d.guest || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q),
      )
      finalResult = { data: filtered, total: response.total }
    }

    await this.cache.set(cacheKey, finalResult, 300)
    return finalResult
  }

  async getById(id: string, user: CurrentUser): Promise<FacturasDTO> {
    this.logger.info('Obteniendo factura', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Factura no encontrada')
    // IDOR (REGLA #9): la factura debe pertenecer al hotel del usuario.
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    return enrichInvoice(item, this.enrichDeps)
  }

  // ─── Emisión ──────────────────────────────────────────────────
  async create(dto: CreateFacturasDTO, user: CurrentUser): Promise<FacturasDTO> {
    const hotelId = dto.hotelId ?? user.hotelId ?? ''
    this.logger.info('Creando factura/cargo/pago', { type: dto.type, hotelId })
    const type = dto.type ?? 'invoice'
    const base = Number(dto.amount) || 0

    let taxes = 0
    let amount = base
    let invoiceNumber = dto.invoiceNumber
    let ncf = dto.ncf

    if (type === 'invoice') {
      const rate = await taxRateFor(this.configRepo, hotelId)
      const t = applyTax(base, rate)
      taxes = t.tax
      amount = t.total
      if (!invoiceNumber) invoiceNumber = await this.nextNumber(hotelId, 'INV')
      if (!ncf) ncf = `NCF-${invoiceNumber}`
    } else if (!invoiceNumber) {
      const prefix = type === 'payment' ? 'PAY' : type === 'folio' ? 'CHG' : 'DOC'
      invoiceNumber = `${prefix}-${Date.now()}`
    }

    const record = buildInvoiceRecord({ hotelId, type, taxes, amount, invoiceNumber, ncf: ncf ?? null, dto })

    const item = await this.repo.create(record as any)
    await this.sockets.onFacturasCreated?.(item)
    await this.cache.delete('facturas:list:' + (item.hotelId || 'all'))
    return enrichInvoice(item, this.enrichDeps)
  }

  private async nextNumber(hotelId: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear()
    try {
      // Solo contar facturas reales (no pagos ni folios que comparten la tabla).
      const invoices = await this.repo.findMany({ hotelId, type: 'invoice' })
      // Extraer el sufijo numérico más alto del formato "{prefix}-{year}-{NNNN}".
      const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`^${safePrefix}-${year}-(\\d+)$`)
      const maxSeq = invoices.reduce((max, inv: any) => {
        const m = re.exec(String(inv.invoiceNumber || ''))
        return m ? Math.max(max, Number(m[1])) : max
      }, 0)
      return `${prefix}-${year}-${(maxSeq + 1).toString().padStart(4, '0')}`
    } catch {
      return `${prefix}-${year}-${Date.now()}`
    }
  }

  async update(id: string, dto: UpdateFacturasDTO, user: CurrentUser): Promise<FacturasDTO> {
    this.logger.info('Actualizando factura', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Factura no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.repo.update(id, dto as Partial<Omit<FacturasDTO, 'id'>>)
    if (!item) throw new NotFoundError('Factura no encontrada')
    await this.sockets.onFacturasUpdated?.(item)
    await this.cache.delete('facturas:list:' + (existing.hotelId || 'all'))
    return enrichInvoice(item, this.enrichDeps)
  }

  // ─── Aplicar pago a una factura ───────────────────────────────
  async pay(id: string, dto: PayFacturasDTO, user: CurrentUser): Promise<FacturasDTO> {
    this.logger.info('Aplicando pago a factura', { id, method: dto.method })
    const inv = await this.repo.findById(id)
    if (!inv) throw new NotFoundError('Factura no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(inv.hotelId, me?.hotelId ?? '', user.role, 'super_admin')

    const updated = await this.repo.update(id, {
      status: 'paid',
      paymentMethod: dto.method ?? inv.paymentMethod ?? null,
      notes: dto.notes ? `${inv.notes ?? ''}\n${dto.notes}`.trim() : inv.notes,
      updatedAt: new Date().toISOString(),
    } as any)
    if (!updated) throw new NotFoundError('Factura no encontrada')

    try {
      await this.repo.create({
        hotelId: inv.hotelId,
        reservationId: inv.reservationId ?? null,
        guestId: inv.guestId ?? null,
        invoiceNumber: `PAY-${Date.now()}`,
        type: 'payment',
        amount: Number(dto.amount) || Number(inv.amount),
        taxes: 0,
        currency: inv.currency,
        status: 'paid',
        issueDate: new Date().toISOString().split('T')[0],
        paymentMethod: dto.method ?? null,
        notes: `Pago de ${inv.invoiceNumber}${dto.reference ? ` | Ref: ${dto.reference}` : ''}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any)
    } catch (e) {
      this.logger.warn('No se pudo registrar el comprobante de pago', { error: (e as Error).message })
    }

    await this.sockets.onFacturasUpdated?.(updated)
    await this.cache.delete('facturas:list:' + (inv.hotelId || 'all'))
    return enrichInvoice(updated, this.enrichDeps)
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    this.logger.info('Eliminando factura', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Factura no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Factura no encontrada')
    await this.sockets.onFacturasDeleted?.(id)
    await this.cache.delete('facturas:list:' + (existing.hotelId || 'all'))
  }
}
