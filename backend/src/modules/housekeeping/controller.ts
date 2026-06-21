// housekeeping/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { HousekeepingService } from './service'
import { CreateHousekeepingSchema, UpdateHousekeepingSchema } from './validators/schema'

export class HousekeepingController {
  constructor(
    private readonly service: HousekeepingService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /housekeeping')
    const result = await this.service.list(req.query as any)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /housekeeping/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id)
    if (!item) return { status: 404, body: { message: 'Housekeeping no encontrado' } }
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /housekeeping')
    const data = validateSchema(CreateHousekeepingSchema, req.body)
    const item = await this.service.create(data as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /housekeeping/:id', { id: req.params.id })
    const data = validateSchema(UpdateHousekeepingSchema, req.body)
    const item = await this.service.update(req.params.id, data as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /housekeeping/:id', { id: req.params.id })
    await this.service.delete(req.params.id)
    return { status: 204, body: null }
  }
}
