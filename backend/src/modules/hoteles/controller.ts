// hoteles/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { HotelesService } from './service'
import { CreateHotelesSchema, UpdateHotelesSchema } from './validators/schema'

export class HotelesController {
  constructor(
    private readonly service: HotelesService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /hoteles')
    const currentUser = req.user as any
    const result = await this.service.list(req.query as any, currentUser)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /hoteles/:id', { id: req.params.id })
    const currentUser = req.user as any
    const item = await this.service.getById(req.params.id, currentUser)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /hoteles')
    const data = validateSchema(CreateHotelesSchema, req.body)
    const item = await this.service.create(data as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /hoteles/:id', { id: req.params.id })
    const currentUser = req.user as any
    const data = validateSchema(UpdateHotelesSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /hoteles/:id', { id: req.params.id })
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }
}
