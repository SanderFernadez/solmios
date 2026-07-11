// capacitacion/service.ts — Cursos/certificaciones + inscripciones de empleados.
// Multi-tenant: todo scopea por hotelId; el ownership se garantiza consultando por { id, hotelId }
// juntos (sin lookup por id suelto → sin IDOR).

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  CourseDTO, CreateCourseDTO, EnrollmentDTO, CreateEnrollmentDTO,
} from './types'

export class CapacitacionService {
  constructor(
    private readonly courseRepo: RepositoryAdapter<CourseDTO>,
    private readonly enrollRepo: RepositoryAdapter<EnrollmentDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly profileRepo?: RepositoryAdapter<{ id: string; hotelId: string }>,
  ) {}

  // ─── Cursos ───────────────────────────────────────────
  async listCourses(hotelId: string): Promise<CourseDTO[]> { return this.courseRepo.findMany({ hotelId }) }

  async getCourse(id: string, hotelId: string): Promise<CourseDTO> {
    const c = await this.courseRepo.findOne({ id, hotelId })
    if (!c) throw new NotFoundError('Curso no encontrado')
    return c
  }

  async createCourse(dto: CreateCourseDTO): Promise<CourseDTO> {
    return this.courseRepo.create({ ...dto, active: 1 } as any)
  }

  async updateCourse(id: string, hotelId: string, dto: Partial<CreateCourseDTO> & { active?: number }): Promise<CourseDTO> {
    await this.getCourse(id, hotelId)
    return this.courseRepo.update(id, dto as any) as Promise<CourseDTO>
  }

  async deleteCourse(id: string, hotelId: string): Promise<void> {
    await this.getCourse(id, hotelId)
    const enrolled = await this.enrollRepo.findMany({ courseId: id, hotelId })
    await Promise.all(enrolled.map((r) => this.enrollRepo.delete(r.id)))
    await this.courseRepo.delete(id)
  }

  // ─── Inscripciones ────────────────────────────────────
  async listEnrollments(hotelId: string, employeeId?: string, courseId?: string): Promise<EnrollmentDTO[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (employeeId) filters.employeeId = employeeId
    if (courseId) filters.courseId = courseId
    return this.enrollRepo.findMany(filters)
  }

  /** Inscribe a un empleado en un curso. Valida curso y empleado del hotel; no duplica inscripción activa. */
  async enroll(dto: CreateEnrollmentDTO): Promise<EnrollmentDTO> {
    await this.getCourse(dto.courseId, dto.hotelId)   // curso del hotel
    if (this.profileRepo) {
      const emp = await this.profileRepo.findOne({ id: dto.employeeId, hotelId: dto.hotelId })
      if (!emp) throw new ValidationError('El empleado no pertenece a este hotel')
    }
    const dup = await this.enrollRepo.findOne({ hotelId: dto.hotelId, courseId: dto.courseId, employeeId: dto.employeeId, status: 'enrolled' })
    if (dup) throw new ValidationError('El empleado ya está inscripto en este curso')
    return this.enrollRepo.create({ ...dto, status: 'enrolled', enrolledAt: new Date().toISOString() } as any)
  }

  /** Marca la inscripción como completada; si el curso vence, calcula expiresAt. */
  async complete(id: string, hotelId: string, score?: number): Promise<EnrollmentDTO> {
    const enrollment = await this.enrollRepo.findOne({ id, hotelId })
    if (!enrollment) throw new NotFoundError('Inscripción no encontrada')
    const course = await this.courseRepo.findOne({ id: enrollment.courseId, hotelId })
    const now = new Date()
    let expiresAt: string | null = null
    const validity = Number(course?.validityMonths ?? 0)
    if (validity > 0) {
      const exp = new Date(now); exp.setMonth(exp.getMonth() + validity); expiresAt = exp.toISOString()
    }
    return this.enrollRepo.update(id, {
      status: 'completed', completedAt: now.toISOString(), expiresAt, score: score ?? null,
    } as any) as Promise<EnrollmentDTO>
  }

  async deleteEnrollment(id: string, hotelId: string): Promise<void> {
    const e = await this.enrollRepo.findOne({ id, hotelId })
    if (!e) throw new NotFoundError('Inscripción no encontrada')
    await this.enrollRepo.delete(id)
  }
}
