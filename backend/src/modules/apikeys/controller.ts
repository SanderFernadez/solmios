// apikeys/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ApikeysService } from './service'
import { CreateApikeysSchema, UpdateApikeysSchema } from './validators/schema'

export class ApikeysController {
  constructor(
    private readonly service: ApikeysService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /apikeys')
    const result = await this.service.list(req.query as any)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /apikeys/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /apikeys')
    const data = validateSchema(CreateApikeysSchema, req.body)
    const item = await this.service.create(data as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /apikeys/:id', { id: req.params.id })
    const data = validateSchema(UpdateApikeysSchema, req.body)
    const item = await this.service.update(req.params.id, data as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /apikeys/:id', { id: req.params.id })
    await this.service.delete(req.params.id)
    return { status: 204, body: null }
  }
}
