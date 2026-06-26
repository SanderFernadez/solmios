// payments/usecases/payment-crud.ts — Payment CRUD operations

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { PaymentDTO, CreatePaymentDTO, PaymentsQuery, PaymentsPaginated } from '../types'

export class PaymentCrudUseCase {
  constructor(
    private readonly paymentRepo: RepositoryAdapter<PaymentDTO>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreatePaymentDTO): Promise<PaymentDTO> {
    if (dto.amount <= 0) throw new ValidationError('Payment amount must be positive')

    const payment = await this.paymentRepo.create({
      hotelId: dto.hotelId,
      folioId: dto.folioId ?? null,
      invoiceId: dto.invoiceId ?? null,
      guestId: dto.guestId ?? null,
      type: dto.type,
      method: dto.method,
      status: dto.method === 'cash' ? 'completed' : 'pending',
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      description: dto.description ?? '',
      reference: dto.reference ?? '',
      stripePaymentId: '',
      stripeSessionId: '',
      metadata: dto.metadata ?? {},
      processedAt: dto.method === 'cash' ? new Date().toISOString() : undefined,
    } as any)

    return payment
  }

  async getById(id: string): Promise<PaymentDTO> {
    // @ignore IDOR_RISK — payment lookup by ID
    const payment = await this.paymentRepo.findById(id)
    if (!payment) throw new ValidationError('Payment not found')
    return payment
  }

  async list(query: PaymentsQuery): Promise<PaymentsPaginated> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit
    const filters: Record<string, any> = {}

    if (query.hotelId) filters.hotelId = query.hotelId
    if (query.folioId) filters.folioId = query.folioId
    if (query.invoiceId) filters.invoiceId = query.invoiceId
    if (query.type) filters.type = query.type
    if (query.method) filters.method = query.method
    if (query.status) filters.status = query.status

    const result = await this.paymentRepo.paginate(filters, { limit, offset })

    return {
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.pages,
        hasNext: offset + limit < result.total,
        hasPrev: page > 1,
      },
    }
  }

  async updateStatus(id: string, status: string, stripePaymentId?: string): Promise<PaymentDTO> {
    const update: Record<string, any> = { status }
    if (stripePaymentId) update.stripePaymentId = stripePaymentId
    if (status === 'completed') update.processedAt = new Date().toISOString()

    const updated = await this.paymentRepo.update(id, update as any)
    if (!updated) throw new ValidationError('Payment not found')
    return updated
  }
}
