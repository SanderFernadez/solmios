// activos/controller.ts — Adaptador HTTP del módulo de activos.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ActivosService } from './service'
import { CreateActivosSchema, UpdateActivosSchema, AssignAssetSchema } from './validators/schema'

/** hotelId sale del token (o del query como fallback); el cliente no lo manda en el body. */
const hotelOf = (req: HttpRequest): string => (req as any).user?.hotelId ?? (req.query as any)?.hotelId ?? ''

export class ActivosController {
  constructor(
    private readonly service: ActivosService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    const q = req.query as any
    return { status: 200, body: await this.service.list({ hotelId: hotelOf(req), status: q.status, category: q.category, assignedTo: q.assignedTo }) }
  }

  async show(req: HttpRequest) {
    return { status: 200, body: await this.service.getById(req.params.id, hotelOf(req)) }
  }

  async store(req: HttpRequest) {
    const body = (req.body ?? {}) as Record<string, unknown>
    const data = validateSchema(CreateActivosSchema, { ...body, hotelId: hotelOf(req) }) as any
    return { status: 201, body: await this.service.create(data) }
  }

  async update(req: HttpRequest) {
    const data = validateSchema(UpdateActivosSchema, req.body) as any
    return { status: 200, body: await this.service.update(req.params.id, hotelOf(req), data) }
  }

  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, hotelOf(req), (req as any).user)
    return { status: 204, body: null }
  }

  async assign(req: HttpRequest) {
    const data = validateSchema(AssignAssetSchema, req.body) as any
    return { status: 200, body: await this.service.assign(req.params.id, hotelOf(req), data.employeeId) }
  }

  async returnAsset(req: HttpRequest) {
    return { status: 200, body: await this.service.returnAsset(req.params.id, hotelOf(req)) }
  }
}
