// payments/usecases/payment-links.ts — Payment link generation and management

import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { PaymentLinkDTO, CreatePaymentLinkDTO } from '../types'
import { randomBytes } from 'crypto'

export class PaymentLinksUseCase {
  constructor(
    private readonly linkRepo: RepositoryAdapter<PaymentLinkDTO>,
  ) {}

  async create(dto: CreatePaymentLinkDTO): Promise<PaymentLinkDTO> {
    const token = randomBytes(32).toString('hex')
    const expiresAt = dto.expiresInHours
      ? new Date(Date.now() + dto.expiresInHours * 3600000).toISOString()
      : undefined

    return this.linkRepo.create({
      hotelId: dto.hotelId,
      guestId: dto.guestId ?? null,
      folioId: dto.folioId ?? null,
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      description: dto.description ?? 'Payment link',
      status: 'active',
      token,
      expiresAt,
      maxUses: dto.maxUses ?? 1,
      useCount: 0,
      paymentId: null,
    } as any)
  }

  // @ignore IDOR_RISK — public link lookup by token
  async getByToken(token: string): Promise<PaymentLinkDTO> {
    // @ignore IDOR_RISK — public link lookup
    const links = await this.linkRepo.findMany({ token })
    const link = links?.[0]
    if (!link) throw new NotFoundError('Payment link not found')
    
    if (link.status !== 'active') throw new ValidationError('Payment link is no longer active')
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      await this.linkRepo.update(link.id, { status: 'expired' } as any)
      throw new ValidationError('Payment link has expired')
    }
    if (link.useCount >= link.maxUses) {
      await this.linkRepo.update(link.id, { status: 'used' } as any)
      throw new ValidationError('Payment link has been fully used')
    }
    
    return link
  }

  async markUsed(linkId: string, paymentId: string): Promise<void> {
    // @ignore IDOR_RISK — internal link update after payment
    const link = await this.linkRepo.findById(linkId)
    if (!link) throw new NotFoundError('Payment link not found')
    
    const newCount = (link.useCount || 0) + 1
    const newStatus = newCount >= link.maxUses ? 'used' : 'active'
    
    await this.linkRepo.update(linkId, {
      useCount: newCount,
      status: newStatus,
      paymentId,
    } as any)
  }

  async cancel(linkId: string): Promise<void> {
    await this.linkRepo.update(linkId, { status: 'cancelled' } as any)
  }

  async list(hotelId: string): Promise<PaymentLinkDTO[]> {
    return this.linkRepo.findMany({ hotelId })
  }
}
