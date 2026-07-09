// paquetes/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { PaquetesService } from './service'
import { CreatePaquetesSchema, UpdatePaquetesSchema } from './validators/schema'

export class PaquetesController {
  constructor(
    private readonly service: PaquetesService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /paquetes')
    const result = await this.service.list(req.query as any, req.user as any)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /paquetes/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /paquetes')
    const data = validateSchema(CreatePaquetesSchema, req.body)
    const item = await this.service.create(data as any, req.user as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /paquetes/:id', { id: req.params.id })
    const data = validateSchema(UpdatePaquetesSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /paquetes/:id', { id: req.params.id })
    await this.service.delete(req.params.id, req.user as any)
    return { status: 204, body: null }
  }
}
