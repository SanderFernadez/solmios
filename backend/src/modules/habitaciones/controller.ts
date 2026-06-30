import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { HabitacionesService } from './service'
import { CreateHabitacionesSchema, UpdateHabitacionesSchema, BatchCreateSchema } from './validators/schema'

export class HabitacionesController {
  constructor(
    private readonly service: HabitacionesService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    const currentUser = req.user as any
    const result = await this.service.list(req.query as any, currentUser)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    const currentUser = req.user as any
    const item = await this.service.getById(req.params.id, currentUser)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(CreateHabitacionesSchema, req.body)
    const item = await this.service.create(data as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateHabitacionesSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }

  async batchStore(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(BatchCreateSchema, req.body)
    const items = await this.service.batchCreate(data as any, currentUser)
    return { status: 201, body: { data: items, total: items.length } }
  }
}
