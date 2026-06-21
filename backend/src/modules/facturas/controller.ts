// facturas/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { FacturasService } from './service'
import { CreateFacturasSchema, UpdateFacturasSchema } from './validators/schema'

export class FacturasController {
  constructor(
    private readonly service: FacturasService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /facturas')
    const result = await this.service.list(req.query as any)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /facturas/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /facturas')
    const data = validateSchema(CreateFacturasSchema, req.body)
    const item = await this.service.create(data as any, req.user as any)
    return { status: 201, body: item }
  }

  async pay(req: HttpRequest) {
    this.logger.info('POST /facturas/:id/pay', { id: req.params.id })
    const item = await this.service.pay(req.params.id, (req.body ?? {}) as any, req.user as any)
    return { status: 200, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /facturas/:id', { id: req.params.id })
    const data = validateSchema(UpdateFacturasSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /facturas/:id', { id: req.params.id })
    await this.service.delete(req.params.id, req.user as any)
    return { status: 204, body: null }
  }
}
