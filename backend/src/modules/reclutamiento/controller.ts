// reclutamiento/controller.ts — Adaptador HTTP del módulo de reclutamiento.
// SIN lógica de negocio. SIN ORM directo. Toda mutación pasa por validateSchema().

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ReclutamientoService } from './service'
import {
  CreateReclutamientoSchema, UpdateReclutamientoSchema,
  MoveStageSchema, RejectApplicantSchema,
} from './validators/schema'

export class ReclutamientoController {
  constructor(
    private readonly service: ReclutamientoService,
    private readonly logger: Logger,
  ) {}

  private hotelOf(req: HttpRequest): string {
    return (req as any).user?.hotelId ?? (req.query as any)?.hotelId ?? ''
  }

  /** hotelId sale del token (no del body): el cliente no lo manda. Va antes de validar. */
  private withHotelId(req: HttpRequest): Record<string, unknown> {
    const body = (req.body ?? {}) as Record<string, unknown>
    return { ...body, hotelId: this.hotelOf(req) || body.hotelId }
  }

  async index(req: HttpRequest) {
    this.logger.info('GET /api/applicants')
    const q = req.query as any
    const items = await this.service.list({ hotelId: this.hotelOf(req), jobPositionId: q.jobPositionId, stage: q.stage })
    return { status: 200, body: items }
  }

  async pipeline(req: HttpRequest) {
    return { status: 200, body: await this.service.pipeline(this.hotelOf(req)) }
  }

  async show(req: HttpRequest) {
    const item = await this.service.getById(req.params.id, (req as any).user)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /api/applicants')
    const data = validateSchema(CreateReclutamientoSchema, this.withHotelId(req))
    return { status: 201, body: await this.service.create(data as any) }
  }

  async update(req: HttpRequest) {
    const data = validateSchema(UpdateReclutamientoSchema, req.body)
    return { status: 200, body: await this.service.update(req.params.id, data as any, (req as any).user) }
  }

  async moveStage(req: HttpRequest) {
    this.logger.info('POST /api/applicants/:id/stage')
    const data = validateSchema(MoveStageSchema, req.body) as { stage: string }
    return { status: 200, body: await this.service.moveStage(req.params.id, data.stage, (req as any).user) }
  }

  async reject(req: HttpRequest) {
    const data = validateSchema(RejectApplicantSchema, req.body) as { reason: string }
    return { status: 200, body: await this.service.reject(req.params.id, data.reason, (req as any).user) }
  }

  async hire(req: HttpRequest) {
    this.logger.info('POST /api/applicants/:id/hire')
    const employeeId = (req.body as any)?.hiredEmployeeId
    return { status: 200, body: await this.service.hire(req.params.id, employeeId, (req as any).user) }
  }

  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, (req as any).user)
    return { status: 204, body: null }
  }
}
