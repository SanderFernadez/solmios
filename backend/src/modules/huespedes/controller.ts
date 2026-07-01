// huespedes/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { HuespedesService } from './service'
import { CreateHuespedesSchema, UpdateHuespedesSchema } from './validators/schema'

// validateSchema del framework no contempla tipos json/text (los descarta del output).
// Estos campos estructurados se recuperan del body crudo; el ORM los serializa al guardar.
const JSON_TEXT_FIELDS = ['preferences', 'notes', 'emergencyContact'] as const

function withJsonTextFields(validated: Record<string, unknown>, body: unknown): Record<string, unknown> {
  const merged = { ...validated }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    for (const f of JSON_TEXT_FIELDS) {
      if (b[f] !== undefined) merged[f] = b[f]
    }
  }
  return merged
}

export class HuespedesController {
  constructor(
    private readonly service: HuespedesService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /huespedes')
    const result = await this.service.list(req.query as any, req.user as any)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    this.logger.info('GET /huespedes/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /huespedes')
    const data = withJsonTextFields(validateSchema(CreateHuespedesSchema, req.body), req.body)
    const item = await this.service.create(data as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /huespedes/:id', { id: req.params.id })
    const data = withJsonTextFields(validateSchema(UpdateHuespedesSchema, req.body), req.body)
    const item = await this.service.update(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /huespedes/:id', { id: req.params.id })
    await this.service.delete(req.params.id, req.user as any)
    return { status: 204, body: null }
  }
}
