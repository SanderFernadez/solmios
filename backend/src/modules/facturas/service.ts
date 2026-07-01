// facturas/service.ts — Casos de uso de facturación del hotel.
// Delega la lógica pura a ./usecases/ para mantenerse < 200 líneas.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { FacturasDTO, CreateFacturasDTO, UpdateFacturasDTO, PayFacturasDTO, FacturasQuery, FacturasListResult, CurrentUser, FacturasStats } from './types'
import type { FacturasSockets } from './sockets'
import { taxRateFor, applyTax, buildInvoiceRecord, enrichInvoice, assertOwnership, type EnrichDeps } from './usecases/billing'
import { nextInvoiceNumber } from './usecases/invoice-number'
import { getFacturasStats } from './usecases/stats'
import { createPaymentRecord } from './usecases/payment-record'
import { generateCreditNote, type CreditNoteResult } from './usecases/credit-note'
import { generateTaxReport, type TaxReport } from './usecases/tax-report'
import { persistItems, attachItems } from './usecases/invoice-items'

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
    private readonly itemRepo: RepositoryAdapter<any>,
  ) {
    this.enrichDeps = deps
  }

  private hotelFilter(user: CurrentUser): Record<string, unknown> {
    if (user.role !== 'super_admin' && user.hotelId) return { hotelId: user.hotelId }
    return {}
  }

  setSockets(s: Partial<FacturasSockets>): void {
    const cur = this.sockets as Record<string, any>
    for (const [k, h] of Object.entries(s as Record<string, any>)) {
      if (!h) continue
      const prev = cur[k]
      cur[k] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // ─── Lectura ──────────────────────────────────────────────────
  async list(query?: FacturasQuery, user?: CurrentUser): Promise<FacturasListResult> {
    this.logger.info('Listando facturas', { query })
    const filters: Record<string, unknown> = {}
    if (query?.type) filters.type = query.type
    if (query?.status) filters.status = query.status
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
    const data = await Promise.all(result.data.map(async (r) => attachItems(this.itemRepo,await enrichInvoice(r, this.enrichDeps))))
    const pages = Math.ceil(result.total / limit)
    const response = { data, total: result.total, limit, offset, pages, hasNext: page < pages, hasPrev: page > 1 }

    let finalResult = response
    if (query?.search) {
      const q = String(query.search).toLowerCase()
      const filtered = data.filter((d) =>
        (d.invoiceNumber || '').toLowerCase().includes(q) ||
        (d.guest || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q),
      )
      finalResult = { data: filtered, total: filtered.length, limit, offset, pages, hasNext: false, hasPrev: page > 1 }
    }

    await this.cache.set(cacheKey, finalResult, 300)
    return finalResult
  }

  async getById(id: string, user?: CurrentUser): Promise<FacturasDTO> {
    this.logger.info('Obteniendo factura', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Factura no encontrada')
    if (user) await assertOwnership(this.userRepo, this.auth,item.hotelId, user.id, user.role)
    return attachItems(this.itemRepo,await enrichInvoice(item, this.enrichDeps))
  }

  // ─── Emisión ──────────────────────────────────────────────────
  async create(dto: CreateFacturasDTO, user: CurrentUser): Promise<FacturasDTO> {
    const hotelId = dto.hotelId ?? user.hotelId ?? ''
    this.logger.info('Creando factura/cargo/pago', { type: dto.type, hotelId })
    const type = dto.type ?? 'invoice'
    const base = Number(dto.amount) || 0
    let taxes = 0, amount = base, invoiceNumber = dto.invoiceNumber, ncf = dto.ncf
    if (type === 'invoice') {
      const rate = await taxRateFor(this.configRepo, hotelId)
      const t = applyTax(base, rate)
      taxes = t.tax
      amount = t.total
      if (!invoiceNumber) invoiceNumber = await nextInvoiceNumber(this.repo, this.configRepo, hotelId, 'INV')
      if (!ncf) ncf = `NCF-${invoiceNumber}`
    } else if (!invoiceNumber) {
      const prefix = type === 'payment' ? 'PAY' : type === 'folio' ? 'CHG' : 'DOC'
      invoiceNumber = `${prefix}-${Date.now()}`
    }

    const record = buildInvoiceRecord({ hotelId, type, taxes, amount, invoiceNumber, ncf: ncf ?? null, dto })

    const item = await this.repo.create(record as any)
    if (Array.isArray(dto.items) && dto.items.length) {
      await persistItems(this.itemRepo, item.id, hotelId, dto.items)
    }
    await this.sockets.onFacturasCreated?.(item)
    await this.cache.delete('facturas:list:' + (item.hotelId || 'all'))
    return attachItems(this.itemRepo,await enrichInvoice(item, this.enrichDeps))
  }

  async update(id: string, dto: UpdateFacturasDTO, user: CurrentUser): Promise<FacturasDTO> {
    this.logger.info('Actualizando factura', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Factura no encontrada')
    await assertOwnership(this.userRepo, this.auth,existing.hotelId, user.id, user.role)
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
    await assertOwnership(this.userRepo, this.auth,inv.hotelId, user.id, user.role)

    // Pago parcial: acumular amountPaid y determinar status
    const newPaid = (Number(inv.amountPaid) || 0) + (Number(dto.amount) || Number(inv.amount))
    const newStatus = newPaid >= (Number(inv.amount) || 0) ? 'paid' : 'pending'

    const updated = await this.repo.update(id, {
      status: newStatus,
      amountPaid: newPaid,
      paymentMethod: dto.method ?? inv.paymentMethod ?? null,
      notes: dto.notes ? `${inv.notes ?? ''}\n${dto.notes}`.trim() : inv.notes,
      updatedAt: new Date().toISOString(),
    } as any)
    if (!updated) throw new NotFoundError('Factura no encontrada')

    await createPaymentRecord(this.repo, inv, dto, this.logger)

    await this.sockets.onFacturasUpdated?.(updated)
    await this.cache.delete('facturas:list:' + (inv.hotelId || 'all'))
    return enrichInvoice(updated, this.enrichDeps)
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    this.logger.info('Eliminando factura', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Factura no encontrada')
    await assertOwnership(this.userRepo, this.auth,existing.hotelId, user.id, user.role)
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Factura no encontrada')
    await this.sockets.onFacturasDeleted?.(id)
    await this.cache.delete('facturas:list:' + (existing.hotelId || 'all'))
  }

  // ─── Nota de crédito ─────────────────────────────────────
  async creditNote(id: string, reason: string, user: CurrentUser): Promise<CreditNoteResult> {
    this.logger.info('Generando nota de crédito', { id })
    const inv = await this.repo.findById(id)
    if (!inv) throw new NotFoundError('Factura no encontrada')
    await assertOwnership(this.userRepo, this.auth,inv.hotelId, user.id, user.role)
    if (inv.status === 'cancelled') throw new NotFoundError('La factura ya está cancelada')
    const result = await generateCreditNote(this.repo, inv, reason, user.id)
    await this.sockets.onFacturasUpdated?.(result.originalInvoice)
    await this.cache.delete('facturas:list:' + (inv.hotelId || 'all'))
    return result
  }

  // ─── Stats ─────────────────────────────────────────────
  async getStats(user: CurrentUser): Promise<FacturasStats> {
    const cacheKey = `facturas:stats:${user.hotelId || 'all'}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as FacturasStats
    const stats = await getFacturasStats(this.repo, this.hotelFilter(user))
    await this.cache.set(cacheKey, stats, 120)
    return stats
  }
  async taxReport(user: CurrentUser, from?: string, to?: string): Promise<TaxReport> {
    return generateTaxReport(this.repo, this.hotelFilter(user), from, to)
  }
}