// empleados/usecases/reviews.ts — Performance review management

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PerformanceReviewDTO, CreatePerformanceReviewDTO } from '../types'
import type { SimpleUser } from './ownership'

export class ReviewUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<PerformanceReviewDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreatePerformanceReviewDTO): Promise<PerformanceReviewDTO> {
    return this.repo.create({
      ...dto,
      status: 'draft',
      period: dto.period ?? '',
    } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<PerformanceReviewDTO> {
    const review = await this.repo.findById(id)
    if (!review) throw new NotFoundError('Performance review not found')
    if (this.auth && user) this.auth.assertOwnership(review.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return review
  }

  async list(hotelId: string, employeeId?: string): Promise<PerformanceReviewDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  async complete(id: string, user?: SimpleUser): Promise<PerformanceReviewDTO> {
    const review = await this.getById(id, user)
    if (review.status === 'completed') throw new ValidationError('Review already completed')
    return this.repo.update(id, { status: 'completed' } as any) as Promise<PerformanceReviewDTO>
  }
}
