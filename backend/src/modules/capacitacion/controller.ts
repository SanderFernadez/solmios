// capacitacion/controller.ts — Adaptador HTTP (cursos + inscripciones).
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { CapacitacionService } from './service'
import { CreateCourseSchema, UpdateCourseSchema, EnrollSchema, CompleteEnrollmentSchema } from './validators/schema'

const hotelOf = (req: HttpRequest): string => (req as any).user?.hotelId ?? (req.query as any)?.hotelId ?? ''

export class CapacitacionController {
  constructor(
    private readonly service: CapacitacionService,
    private readonly logger: Logger,
  ) {}

  // ─── Cursos ───────────────────────────────────────────
  async listCourses(req: HttpRequest) {
    const data = await this.service.listCourses(hotelOf(req))
    return { status: 200, body: { data, total: data.length } }
  }
  async createCourse(req: HttpRequest) {
    const body = (req.body ?? {}) as Record<string, unknown>
    const data = validateSchema(CreateCourseSchema, { ...body, hotelId: hotelOf(req) }) as any
    return { status: 201, body: await this.service.createCourse(data) }
  }
  async updateCourse(req: HttpRequest) {
    const data = validateSchema(UpdateCourseSchema, req.body) as any
    return { status: 200, body: await this.service.updateCourse(req.params.id, hotelOf(req), data) }
  }
  async deleteCourse(req: HttpRequest) {
    await this.service.deleteCourse(req.params.id, hotelOf(req))
    return { status: 204, body: null }
  }

  // ─── Inscripciones ────────────────────────────────────
  async listEnrollments(req: HttpRequest) {
    const q = req.query as any
    const data = await this.service.listEnrollments(hotelOf(req), q.employeeId, q.courseId)
    return { status: 200, body: { data, total: data.length } }
  }
  async enroll(req: HttpRequest) {
    const body = (req.body ?? {}) as Record<string, unknown>
    const data = validateSchema(EnrollSchema, { ...body, hotelId: hotelOf(req) }) as any
    return { status: 201, body: await this.service.enroll(data) }
  }
  async completeEnrollment(req: HttpRequest) {
    const { score } = validateSchema(CompleteEnrollmentSchema, req.body ?? {}) as { score?: number }
    return { status: 200, body: await this.service.complete(req.params.id, hotelOf(req), score) }
  }
  async deleteEnrollment(req: HttpRequest) {
    await this.service.deleteEnrollment(req.params.id, hotelOf(req))
    return { status: 204, body: null }
  }
}
