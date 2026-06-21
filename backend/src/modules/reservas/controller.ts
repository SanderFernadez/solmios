// reservas/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ReservasService } from './service'
import { CreateReservasSchema, UpdateReservasSchema } from './validators/schema'

export class ReservasController {
  constructor(
    private readonly service: ReservasService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /reservas')
    const result = await this.service.list(req.query as any)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /reservas/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /reservas')
    const data = validateSchema(CreateReservasSchema, req.body)
    const item = await this.service.create(data as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /reservas/:id', { id: req.params.id })
    const data = validateSchema(UpdateReservasSchema, req.body)
    const item = await this.service.update(req.params.id, data as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /reservas/:id', { id: req.params.id })
    await this.service.delete(req.params.id)
    return { status: 204, body: null }
  }
}
