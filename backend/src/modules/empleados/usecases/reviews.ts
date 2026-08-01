// empleados/usecases/reviews.ts — Performance review management

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PerformanceReviewDTO, CreatePerformanceReviewDTO, UpdatePerformanceReviewDTO } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'

export class ReviewUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<PerformanceReviewDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreatePerformanceReviewDTO): Promise<PerformanceReviewDTO> {
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)
    return this.repo.create({
      ...dto,
      status: 'draft',
      period: dto.period ?? '',
    } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<PerformanceReviewDTO> {
    const review = await this.repo.findById(id)
    if (!review) throw new NotFoundError('Evaluación de desempeño no encontrada')
    if (this.auth && user) this.auth.assertOwnership(review.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return review
  }

  async list(hotelId: string, employeeId?: string): Promise<PerformanceReviewDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  /** Editar una evaluación en BORRADOR (#193). Una vez completada es inmutable (#194 → solo lectura). */
  async update(id: string, data: UpdatePerformanceReviewDTO, user?: SimpleUser): Promise<PerformanceReviewDTO> {
    const review = await this.getById(id, user)
    if (review.status === 'completed') throw new ValidationError('Una evaluación completada no se edita (solo lectura)')
    const patch: Record<string, unknown> = { ...data }
    if (typeof data.acknowledged === 'boolean') patch.acknowledged = data.acknowledged ? 1 : 0
    return this.repo.update(id, patch as any) as Promise<PerformanceReviewDTO>
  }

  async complete(id: string, user?: SimpleUser): Promise<PerformanceReviewDTO> {
    const review = await this.getById(id, user)
    if (review.status === 'completed') throw new ValidationError('La evaluación ya está completada')
    return this.repo.update(id, { status: 'completed' } as any) as Promise<PerformanceReviewDTO>
  }
}
