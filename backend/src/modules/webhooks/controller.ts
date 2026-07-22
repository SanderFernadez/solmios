// webhooks/controller.ts — Adaptador HTTP del módulo Webhooks.

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, ValidationError } from 'arckode-framework'
import type { WebhooksService } from './service'
import { CreateWebhookSubscriptionSchema, UpdateWebhookSubscriptionSchema } from './validators/schema'

/** `events`: fuera de validateSchema (ver comentario en validators/schema.ts) — se valida a mano. */
function parseEvents(body: unknown, required: boolean): string[] | undefined {
  const events = (body as { events?: unknown })?.events
  if (events === undefined) {
    if (required) throw new ValidationError('events es requerido', { events: ['events es requerido'] })
    return undefined
  }
  if (!Array.isArray(events) || events.some((e) => typeof e !== 'string') || (required && events.length === 0)) {
    throw new ValidationError('events debe ser un array de strings no vacío', { events: ['events debe ser un array de strings'] })
  }
  return events as string[]
}

export class WebhooksController {
  constructor(
    private readonly service: WebhooksService,
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
    const data = validateSchema(CreateWebhookSubscriptionSchema, req.body)
    const events = parseEvents(req.body, true) as string[]
    const item = await this.service.create({ ...data, events } as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateWebhookSubscriptionSchema, req.body)
    const events = parseEvents(req.body, false)
    const item = await this.service.update(req.params.id, { ...data, ...(events !== undefined ? { events } : {}) } as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }

  async test(req: HttpRequest) {
    const currentUser = req.user as any
    const result = await this.service.test(req.params.id, currentUser)
    return { status: 200, body: result }
  }
}
