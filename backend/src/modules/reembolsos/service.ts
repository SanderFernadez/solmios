// reembolsos/service.ts — Flujo de reembolsos: draft → submitted → approved/rejected → paid.
// NO importa de otros módulos (employeeId por valor).

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  ExpenseClaimDTO, CreateExpenseClaimDTO, UpdateExpenseClaimDTO,
  ReembolsosQuery, ClaimTotals,
} from './types'
import type { ReembolsosSockets } from './sockets'

interface SimpleUser { id?: string; hotelId?: string; role?: string }

export class ReembolsosService {
  private sockets: ReembolsosSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<ExpenseClaimDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth?: Auth,
  ) {}

  setSockets(s: Partial<ReembolsosSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]; if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  private own(item: ExpenseClaimDTO, user?: SimpleUser): void {
    if (this.auth && user) this.auth.assertOwnership(item.hotelId, user.hotelId ?? '', user.role ?? '', 'super_admin')
  }

  async list(query: ReembolsosQuery): Promise<ExpenseClaimDTO[]> {
    const filters: Record<string, unknown> = { active: 1 }
    if (query.hotelId) filters.hotelId = query.hotelId
    if (query.employeeId) filters.employeeId = query.employeeId
    if (query.status) filters.status = query.status
    return this.repo.findMany(filters)
  }

  async getById(id: string, user?: SimpleUser): Promise<ExpenseClaimDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Reembolso no encontrado')
    this.own(item, user)
    return item
  }

  async create(dto: CreateExpenseClaimDTO): Promise<ExpenseClaimDTO> {
    if (!(dto.amount > 0)) throw new ValidationError('El monto debe ser positivo')
    const item = await this.repo.create({ ...dto, currency: dto.currency ?? 'DOP', status: 'draft', active: 1 } as any)
    await this.cache.delete('reembolsos:list')
    return item
  }

  /** Solo editable en borrador — una vez enviado, es inmutable salvo por el flujo de aprobación. */
  async update(id: string, dto: UpdateExpenseClaimDTO, user?: SimpleUser): Promise<ExpenseClaimDTO> {
    const current = await this.getById(id, user)
    if (current.status !== 'draft') throw new ValidationError('Solo se edita un reembolso en borrador')
    return this.repo.update(id, dto as any) as Promise<ExpenseClaimDTO>
  }

  async submit(id: string, user?: SimpleUser): Promise<ExpenseClaimDTO> {
    const current = await this.getById(id, user)
    if (current.status !== 'draft') throw new ValidationError('Solo se envía un reembolso en borrador')
    const item = await this.repo.update(id, { status: 'submitted' } as any) as ExpenseClaimDTO
    await this.sockets.onClaimSubmitted?.(item)
    return item
  }

  async approve(id: string, approvedBy: string, user?: SimpleUser): Promise<ExpenseClaimDTO> {
    const current = await this.getById(id, user)
    if (current.status !== 'submitted') throw new ValidationError('Solo se aprueba un reembolso enviado')
    const item = await this.repo.update(id, { status: 'approved', approvedBy, approvedAt: new Date().toISOString() } as any) as ExpenseClaimDTO
    await this.sockets.onClaimApproved?.(item)
    return item
  }

  async reject(id: string, reason: string, approvedBy: string, user?: SimpleUser): Promise<ExpenseClaimDTO> {
    const current = await this.getById(id, user)
    if (current.status === 'paid') throw new ValidationError('Un reembolso pagado no se rechaza')
    return this.repo.update(id, { status: 'rejected', rejectReason: reason, approvedBy } as any) as Promise<ExpenseClaimDTO>
  }

  /** Reintegrar al empleado. Debe estar aprobado. El pago en efectivo lo asienta un connector a caja. */
  async pay(id: string, paymentMethod: string, user?: SimpleUser): Promise<ExpenseClaimDTO> {
    const current = await this.getById(id, user)
    if (current.status !== 'approved') throw new ValidationError('Solo se paga un reembolso aprobado')
    const item = await this.repo.update(id, { status: 'paid', paymentMethod, paidAt: new Date().toISOString() } as any) as ExpenseClaimDTO
    await this.sockets.onClaimPaid?.(item)
    await this.cache.delete('reembolsos:list')
    return item
  }

  async delete(id: string, user?: SimpleUser): Promise<void> {
    const current = await this.getById(id, user)
    if (current.status === 'paid') throw new ValidationError('Un reembolso pagado no se elimina')
    await this.repo.update(id, { active: 0 } as any)
  }

  /** Totales por estado (para el resumen: cuánto falta pagar). */
  async totals(hotelId: string): Promise<ClaimTotals> {
    const all = await this.repo.findMany({ hotelId, active: 1 })
    const bucket = () => ({ count: 0, amount: 0 })
    const t: ClaimTotals = { submitted: bucket(), approved: bucket(), paid: bucket() }
    for (const c of all) {
      const k = c.status as keyof ClaimTotals
      if (t[k]) { t[k].count += 1; t[k].amount += Number(c.amount) || 0 }
    }
    return t
  }
}
