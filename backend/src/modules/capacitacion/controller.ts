// capacitacion/controller.ts — Adaptador HTTP (cursos + inscripciones).
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { CapacitacionService } from './service'
import { CreateCourseSchema, UpdateCourseSchema, EnrollSchema, CompleteEnrollmentSchema } from './validators/schema'
import { confirmPageHtml, confirmDoneHtml } from './usecases/emails'

const hotelOf = (req: HttpRequest): string => (req as any).user?.hotelId ?? (req.query as any)?.hotelId ?? ''
const HTML = { 'content-type': 'text/html; charset=utf-8' }

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
    await this.service.deleteCourse(req.params.id, hotelOf(req), (req as any).user)
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
    await this.service.deleteEnrollment(req.params.id, hotelOf(req), (req as any).user)
    return { status: 204, body: null }
  }

  // ─── Confirmación por link de correo (público, token-based) ──────────────
  /** GET: muestra la página con el botón. NO marca nada (evita que el preview del mail confirme solo). */
  async confirmPage(req: HttpRequest) {
    const token = String(req.params.token || '')
    const courseName = await this.service.peekByToken(token)
    if (courseName === null) return { status: 404, body: '<!doctype html><p style="font-family:sans-serif;text-align:center;padding:40px">Link inválido o vencido.</p>', headers: HTML }
    return { status: 200, body: confirmPageHtml({ courseName, confirmUrl: `/api/training/confirm/${encodeURIComponent(token)}` }), headers: HTML }
  }

  /** POST: el empleado confirmó → marca la inscripción como completada. */
  async confirmSubmit(req: HttpRequest) {
    const token = String(req.params.token || '')
    const res = await this.service.confirmByToken(token)
    if (!res) return { status: 404, body: '<!doctype html><p style="font-family:sans-serif;text-align:center;padding:40px">Link inválido o vencido.</p>', headers: HTML }
    return { status: 200, body: confirmDoneHtml(res.courseName), headers: HTML }
  }
}
