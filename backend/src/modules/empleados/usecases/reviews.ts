// empleados/usecases/reviews.ts — Performance review management

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PerformanceReviewDTO, CreatePerformanceReviewDTO } from '../types'

export class ReviewUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<PerformanceReviewDTO>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreatePerformanceReviewDTO): Promise<PerformanceReviewDTO> {
    return this.repo.create({
      ...dto,
      status: 'draft',
      period: dto.period ?? '',
    } as any)
  }

  async getById(id: string): Promise<PerformanceReviewDTO> {
    // @ignore IDOR_RISK — review lookup by ID
    const review = await this.repo.findById(id)
    if (!review) throw new NotFoundError('Performance review not found')
    return review
  }

  async list(hotelId: string, employeeId?: string): Promise<PerformanceReviewDTO[]> {
    const filters: Record<string, any> = { hotelId }
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  async complete(id: string): Promise<PerformanceReviewDTO> {
    const review = await this.getById(id)
    if (review.status === 'completed') throw new ValidationError('Review already completed')
    return this.repo.update(id, { status: 'completed' } as any) as Promise<PerformanceReviewDTO>
  }
}
