// auditlog/controller.ts — Adaptador HTTP del módulo
// Append-only: solo index, show, store. Sin update ni destroy.

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AuditlogService } from './service'
import { CreateAuditlogSchema } from './validators/schema'

export class AuditlogController {
  constructor(
    private readonly service: AuditlogService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    try {
      this.logger.info('GET /auditlog')
      const result = await this.service.list(req.query as any)
      return { status: 200, body: result }
    } catch (err) {
      this.logger.error('Error in GET /auditlog', err as any)
      throw err
    }
  }

  async show(req: HttpRequest) {
    try {
      this.logger.info('GET /auditlog/:id', { id: req.params.id })
      const item = await this.service.getById(req.params.id, req.user as any)
      if (!item) return { status: 404, body: { message: 'Auditlog no encontrado' } }
      return { status: 200, body: item }
    } catch (err) {
      this.logger.error('Error in GET /auditlog/:id', err as any)
      throw err
    }
  }

  async store(req: HttpRequest) {
    try {
      this.logger.info('POST /auditlog')
      const data = validateSchema(CreateAuditlogSchema, req.body)
      const item = await this.service.create(data as any)
      return { status: 201, body: item }
    } catch (err) {
      this.logger.error('Error in POST /auditlog', err as any)
      throw err
    }
  }
}
