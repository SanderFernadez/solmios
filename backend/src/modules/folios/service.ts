import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { FolioDTO, FolioChargeDTO, OpenFolioDTO, PostChargeDTO, ApplyPaymentDTO, FolioQuery, FolioListResult, CurrentUser } from './types'
import type { FoliosSockets } from './sockets'
import { taxRateFor, applyTax, computeTotals } from './usecases/folio-math'
import { folioSummary } from './usecases/folio-summary'
import { closeAndInvoice as closeAndInvoiceUsecase, type CloseAndInvoiceResult } from './usecases/close-and-invoice'
import { postNightAuditRoomCharges as postNightAuditUsecase } from './usecases/night-audit'

export interface LookupDeps { guest: RepositoryAdapter<any>; reservation: RepositoryAdapter<any>; room: RepositoryAdapter<any>; user: RepositoryAdapter<any> }
const now = () => new Date().toISOString()

export class FoliosService {
  private sockets: FoliosSockets = {}
  constructor(
    private readonly folioRepo: RepositoryAdapter<FolioDTO>,
    private readonly chargeRepo: RepositoryAdapter<FolioChargeDTO>,
    private readonly configRepo: RepositoryAdapter<any>,
    private readonly deps: LookupDeps,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<FoliosSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  private async hotelOf(user: CurrentUser): Promise<string> {
    const u = await this.deps.user.findById(user.id)
    return u?.hotelId ?? ''
  }

  async list(query?: FolioQuery, user?: CurrentUser): Promise<FolioListResult> {
    this.logger.info('Listando folios', { query })
    const filters: Record<string, unknown> = {}
    if (user && user.role !== 'super_admin') {
      const me = await this.deps.user.findById(user.id)
      filters.hotelId = me?.hotelId ?? '__none__'
    } else if (query?.hotelId) {
      filters.hotelId = query.hotelId
    }
    if (query?.status) filters.status = query.status
    if (query?.reservationId) filters.reservationId = query.reservationId
    const cacheKey = `folios:list:${user?.hotelId || 'all'}:${JSON.stringify(query || {})}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as FolioListResult
    const folios = await this.folioRepo.findMany(filters)
    const data = await Promise.all(folios.map((f) => this.enrich(f)))
    const result = { data, total: data.length }
    await this.cache.set(cacheKey, result, 300)
    return result
  }

  async getById(id: string, user: CurrentUser): Promise<FolioDTO> {
    this.logger.info('Obteniendo folio', { id })
    const folio = await this.folioRepo.findById(id)
    if (!folio) throw new NotFoundError('Folio no encontrado')
    const me = await this.deps.user.findById(user.id)
    this.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    return this.enrich(folio, true)
  }

  private async enrich(f: FolioDTO, includeCharges = false): Promise<FolioDTO> {
    const charges = await this.chargeRepo.findMany({ folioId: f.id })
    const totals = computeTotals(charges as FolioChargeDTO[])
    const [g, r] = await Promise.all([
      f.guestId ? this.deps.guest.findById(f.guestId) : null,
      f.roomId ? this.deps.room.findById(f.roomId) : null,
    ])
    return {
      ...f,
      guestName: (g as any)?.name ?? '',
      roomNumber: (r as any)?.number ?? '',
      ...totals,
      charges: includeCharges ? (charges as FolioChargeDTO[]) : undefined,
    }
  }

  async open(dto: OpenFolioDTO, user: CurrentUser): Promise<FolioDTO> {
    const hotelId = (await this.hotelOf(user)) ?? '' // V-02 IDOR: hotelId forzado del JWT, nunca del body
    this.logger.info('Abriendo folio', { hotelId, reservationId: dto.reservationId })
    let guestId = dto.guestId ?? null, roomId = dto.roomId ?? null
    if (dto.reservationId) {
      const res = await this.deps.reservation.findById(dto.reservationId)
      if (res) { guestId = guestId ?? res.guestId ?? null; roomId = roomId ?? res.roomId ?? null }
    }
    const folio = await this.folioRepo.create({
      hotelId, reservationId: dto.reservationId ?? null, guestId, roomId,
      status: 'open', currency: dto.currency ?? 'USD', invoiceId: null,
      openedAt: now(), closedAt: null,
    } as any)
    await this.sockets.onFolioOpened?.(folio)
    await this.cache.delete(`folios:list:${folio.hotelId || 'all'}:*`)
    return this.enrich(folio)
  }

  async postCharge(folioId: string, dto: PostChargeDTO, user: CurrentUser): Promise<FolioChargeDTO> {
    const folio = await this.folioRepo.findById(folioId)
    if (!folio) throw new NotFoundError('Folio no encontrado')
    const me = await this.deps.user.findById(user.id)
    this.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    if (folio.status !== 'open') throw new ValidationError('El folio no está abierto')
    const qty = Number(dto.quantity) || 1
    const base = (Number(dto.amount) || 0) * qty
    if (base <= 0) throw new ValidationError('El monto del cargo debe ser positivo')
    const rate = await taxRateFor(this.configRepo, folio.hotelId)
    const { tax, total } = applyTax(base, rate)
    const charge = await this.chargeRepo.create({
      folioId, hotelId: folio.hotelId, description: dto.description,
      category: dto.category ?? 'other', kind: 'charge', quantity: qty,
      amount: base, taxes: tax, total, source: dto.source ?? 'manual', postedAt: now(),
    } as any)
    await this.sockets.onFolioCharged?.(folio, charge)
    await this.cache.delete(`folios:list:${folio.hotelId || 'all'}:*`)
    return charge as FolioChargeDTO
  }

  async applyPayment(folioId: string, dto: ApplyPaymentDTO, user: CurrentUser): Promise<FolioChargeDTO> {
    const folio = await this.folioRepo.findById(folioId)
    if (!folio) throw new NotFoundError('Folio no encontrado')
    const me = await this.deps.user.findById(user.id)
    this.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    if (folio.status !== 'open') throw new ValidationError('El folio no está abierto')
    const amount = Number(dto.amount) || 0
    if (amount <= 0) throw new ValidationError('El monto del pago debe ser positivo')
    const charges = await this.chargeRepo.findMany({ folioId })
    const { balance } = computeTotals(charges as FolioChargeDTO[])
    if (amount > balance + 0.01) throw new ValidationError(`El pago ($${amount}) excede el saldo pendiente ($${balance})`)
    const charge = await this.chargeRepo.create({
      folioId, hotelId: folio.hotelId,
      description: `Pago${dto.method ? ` (${dto.method})` : ''}${dto.reference ? ` · Ref ${dto.reference}` : ''}`,
      category: 'payment', kind: 'payment', quantity: 1, amount: -amount, taxes: 0,
      total: -amount, source: dto.method ?? 'manual', postedAt: now(),
    } as any)
    await this.sockets.onFolioPaid?.(folio, charge)
    await this.cache.delete(`folios:list:${folio.hotelId || 'all'}:*`)
    return charge as FolioChargeDTO
  }

  // ─── Cerrar folio ──────
  async close(folioId: string, user: CurrentUser): Promise<FolioDTO> {
    const folio = await this.folioRepo.findById(folioId)
    if (!folio) throw new NotFoundError('Folio no encontrado')
    const me = await this.deps.user.findById(user.id)
    this.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    if (folio.status !== 'open') throw new ValidationError('El folio no está abierto')
    const closed = await this.folioRepo.update(folioId, { status: 'closed', closedAt: now() } as any)
    await this.sockets.onFolioClosed?.(closed)
    await this.cache.delete(`folios:list:${folio.hotelId || 'all'}:*`)
    return this.enrich(closed as FolioDTO, true)
  }

  async summary(folioId: string, user?: CurrentUser) {
    return folioSummary({ folioRepo: this.folioRepo, chargeRepo: this.chargeRepo, userRepo: this.deps.user, auth: this.auth }, folioId, user)
  }

  async setInvoice(folioId: string, invoiceId: string, user: CurrentUser): Promise<FolioDTO> {
    const folio = await this.folioRepo.findById(folioId)
    if (!folio) throw new NotFoundError('Folio no encontrado')
    const me = await this.deps.user.findById(user.id)
    this.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
    const updated = await this.folioRepo.update(folioId, { invoiceId } as any)
    return this.enrich(updated as FolioDTO, true)
  }

  /** Cierra el folio y genera la factura con los cargos como líneas de detalle. */
  async closeAndInvoice(folioId: string, user: CurrentUser): Promise<CloseAndInvoiceResult> {
    const result = await closeAndInvoiceUsecase(
      {
        folioRepo: this.folioRepo,
        chargeRepo: this.chargeRepo,
        guestRepo: this.deps.guest,
        roomRepo: this.deps.room,
        userRepo: this.deps.user,
        auth: this.auth,
      },
      folioId,
      user,
    )
    await this.sockets.onFolioClosed?.(result.folio)
    await this.cache.delete(`folios:list:${result.folio.hotelId || 'all'}:*`)
    return result
  }

  async postNightAuditRoomCharges(orm: any, user: any, query?: any): Promise<any> {
    return postNightAuditUsecase(orm, (q:any,u:any)=>this.list(q,u), (d:any,u:any)=>this.open(d,u), (id:string,d:any,u:any)=>this.postCharge(id,d,u), user, query)
  }
}
