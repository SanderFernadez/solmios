// hoteles/controller.ts — Adaptador HTTP del módulo
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { HotelesService } from './service'
import type { HotelesQueries } from './usecases/hoteles-queries'
import { CreateHotelesSchema, UpdateHotelesSchema } from './validators/schema'

export class HotelesController {
  constructor(
    private readonly service: HotelesService,
    private readonly logger: Logger,
    private readonly queries?: HotelesQueries,
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

  // ── Settings ─────────────────────────────────────────────────────────
  async getSettings(req: HttpRequest) {
    const id = await this.resolveHotel(req)
    if (!id) return { status: 404, body: { error: 'Sin hotel' } }
    const result = await this.service.getSettings(id, req.user as any)
    return { status: 200, body: result }
  }

  async updateHotel(req: HttpRequest) {
    const id = (req.body as any).id || (await this.resolveHotel(req))
    if (!id) return { status: 404, body: { error: 'Sin hotel' } }
    const body = await this.service.updateHotel(id, req.body as any, req.user as any)
    return { status: 200, body }
  }

  async getSettingsFull(req: HttpRequest) {
    const id = await this.resolveHotel(req); if (!id) return { status: 404, body: { error: 'Sin hotel' } }
    const result = await this.service.getSettingsFull(id, req.user as any)
    return { status: 200, body: result }
  }

  // ── Configuration KV ────────────────────────────────────────────────
  async getConfig(req: HttpRequest) {
    const id = await this.resolveHotel(req)
    if (!id) return { status: 404, body: { error: 'Sin hotel' } }
    const result = await this.service.getConfig(id, req.params.key)
    return { status: 200, body: result }
  }

  async setConfig(req: HttpRequest) {
    const result = await this.service.setConfig(req.body as any, req.user as any)
    return { status: 200, body: result }
  }

  private async resolveHotel(req: any): Promise<string | undefined> {
    const q = req?.query || {}; if (q.hotelId) return q.hotelId
    if (!this.queries) return undefined
    return this.queries.resolveHotelId(req?.user)
  }
}
