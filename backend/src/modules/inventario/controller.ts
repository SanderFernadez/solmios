// inventario/controller.ts — Adaptador HTTP. Traduce request → service → response. SIN lógica de negocio,
// SIN ORM directo. Toda mutación pasa por validateSchema().
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { InventarioService } from './service'
import { CreateItemSchema, UpdateItemSchema, MovementSchema } from './validators/schema'

export class InventarioController {
  constructor(
    private readonly service: InventarioService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    this.logger.info('GET /inventario/items')
    const q = req.query as any
    const belowMin = q?.belowMin === '1' || q?.belowMin === 'true'
    return { status: 200, body: await this.service.listItems({ category: q?.category, belowMin }, req.user as any) }
  }

  async show(req: HttpRequest) {
    const item = await this.service.getItem(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /inventario/items')
    const data = validateSchema(CreateItemSchema, req.body)
    const item = await this.service.createItem(data as any, req.user as any)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    this.logger.info('PUT /inventario/items/:id', { id: req.params.id })
    const data = validateSchema(UpdateItemSchema, req.body)
    const item = await this.service.updateItem(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    this.logger.info('DELETE /inventario/items/:id', { id: req.params.id })
    await this.service.deleteItem(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  async move(req: HttpRequest) {
    this.logger.info('POST /inventario/items/:id/movements', { id: req.params.id })
    const data = validateSchema(MovementSchema, req.body) as any
    const item = await this.service.moveStock(req.params.id, data, req.user as any)
    return { status: 200, body: item }
  }

  async movements(req: HttpRequest) {
    return { status: 200, body: await this.service.listMovements(req.params.id, req.user as any) }
  }

  async valuation(req: HttpRequest) {
    return { status: 200, body: await this.service.valuation(req.user as any) }
  }
}
