// payments/usecases/deposits.ts — Deposit and guarantee management

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { DepositDTO, CreateDepositDTO, RefundDepositDTO } from '../types'

export class DepositsUseCase {
  constructor(
    private readonly depositRepo: RepositoryAdapter<DepositDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
    private readonly userRepo?: RepositoryAdapter<any>,
  ) {}

  private async assertOwnership(resourceHotelId: string, userId?: string, userRole?: string): Promise<void> {
    if (!this.auth || !this.userRepo || !userId) return
    const me = await this.userRepo.findById(userId)
    this.auth.assertOwnership(resourceHotelId, (me as any)?.hotelId ?? '', userRole || '', 'super_admin')
  }

  async create(dto: CreateDepositDTO): Promise<DepositDTO> {
    if (dto.amount <= 0) throw new ValidationError('Deposit amount must be positive')
    
    return this.depositRepo.create({
      hotelId: dto.hotelId,
      reservationId: dto.reservationId ?? null,
      guestId: dto.guestId ?? null,
      roomId: dto.roomId ?? null,
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      status: 'held',
      paymentMethod: dto.paymentMethod ?? 'card',
      stripePaymentId: '',
      holdReason: dto.holdReason ?? 'reservation_guarantee',
      releasedAt: null,
      refundAmount: 0,
      notes: dto.notes ?? '',
    } as any)
  }

  async getById(id: string, userId?: string, userRole?: string): Promise<DepositDTO> {
    const deposit = await this.depositRepo.findById(id)
    if (!deposit) throw new NotFoundError('Deposit not found')
    await this.assertOwnership(deposit.hotelId, userId, userRole)
    return deposit
  }

  async list(hotelId: string, status?: string): Promise<DepositDTO[]> {
    const filters: Record<string, any> = { hotelId }
    if (status) filters.status = status
    return this.depositRepo.findMany(filters)
  }

  async refund(id: string, dto: RefundDepositDTO, userId?: string, userRole?: string): Promise<DepositDTO> {
    const deposit = await this.getById(id, userId, userRole)
    
    if (deposit.status === 'released' || deposit.status === 'fully_refunded') {
      throw new ValidationError('Deposit already released or fully refunded')
    }

    const refundAmount = dto.amount ?? (deposit.amount - deposit.refundAmount)
    const totalRefunded = deposit.refundAmount + refundAmount
    
    if (totalRefunded > deposit.amount) {
      throw new ValidationError(`Refund amount ($${refundAmount}) exceeds available deposit ($${deposit.amount - deposit.refundAmount})`)
    }

    const newStatus = totalRefunded >= deposit.amount ? 'fully_refunded' : 'partially_refunded'

    this.logger.info('Refunding deposit', { id, amount: refundAmount, totalRefunded })

    return this.depositRepo.update(id, {
      refundAmount: totalRefunded,
      status: newStatus,
      notes: dto.reason ? `${deposit.notes}\nRefund: ${dto.reason}`.trim() : deposit.notes,
    } as any) as Promise<DepositDTO>
  }

  async release(id: string, userId?: string, userRole?: string): Promise<DepositDTO> {
    const deposit = await this.getById(id, userId, userRole)
    
    if (deposit.status === 'released') {
      throw new ValidationError('Deposit already released')
    }

    this.logger.info('Releasing deposit', { id })

    return this.depositRepo.update(id, {
      status: 'released',
      releasedAt: new Date().toISOString(),
    } as any) as Promise<DepositDTO>
  }

  async autoReleaseByCheckOut(reservationId: string, delayHours = 48): Promise<DepositDTO[]> {
    const deposits = await this.depositRepo.findMany({
      reservationId,
      status: 'held',
    })

    const released: DepositDTO[] = []
    for (const deposit of deposits) {
      const createdAt = new Date(deposit.createdAt)
      const holdExpiry = new Date(createdAt.getTime() + delayHours * 3600000)
      if (new Date() >= holdExpiry) {
        const updated = await this.release(deposit.id)
        released.push(updated)
      }
    }

    return released
  }

  async getByReservation(reservationId: string): Promise<DepositDTO[]> {
    return this.depositRepo.findMany({ reservationId })
  }
}
