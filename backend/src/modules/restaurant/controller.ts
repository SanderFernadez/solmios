// restaurant/controller.ts — Adaptador HTTP. Traduce request → service → response.
// SIN lógica de negocio, SIN ORM directo. Toda mutación pasa por validateSchema().
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { RestaurantService } from './service'
import {
  CreateStationSchema, UpdateStationSchema,
  CreateCategorySchema, UpdateCategorySchema,
  CreateItemSchema, UpdateItemSchema, AvailabilitySchema,
  CreateTableSchema, UpdateTableSchema,
  OpenOrderSchema, AddLineSchema, UpdateLineSchema,
  BillSchema, ChargeToRoomSchema, PaySchema,
} from './validators/schema'

export class RestaurantController {
  constructor(
    private readonly service: RestaurantService,
    private readonly logger: Logger,
  ) {}

  // ─── Estaciones (RES-0) ───
  async indexStations(req: HttpRequest) {
    this.logger.info('GET /restaurant/stations')
    const result = await this.service.listStations(req.user as any)
    return { status: 200, body: result }
  }

  async showStation(req: HttpRequest) {
    this.logger.info('GET /restaurant/stations/:id', { id: req.params.id })
    const item = await this.service.getStation(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async storeStation(req: HttpRequest) {
    this.logger.info('POST /restaurant/stations')
    const data = validateSchema(CreateStationSchema, req.body)
    const item = await this.service.createStation(data as any, req.user as any)
    return { status: 201, body: item }
  }

  async updateStation(req: HttpRequest) {
    this.logger.info('PUT /restaurant/stations/:id', { id: req.params.id })
    const data = validateSchema(UpdateStationSchema, req.body)
    const item = await this.service.updateStation(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroyStation(req: HttpRequest) {
    this.logger.info('DELETE /restaurant/stations/:id', { id: req.params.id })
    await this.service.deleteStation(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Carta: categorías (RES-1) ───
  async indexCategories(req: HttpRequest) {
    this.logger.info('GET /restaurant/categories')
    return { status: 200, body: await this.service.listCategories(req.user as any) }
  }
  async showCategory(req: HttpRequest) {
    const item = await this.service.getCategory(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async storeCategory(req: HttpRequest) {
    this.logger.info('POST /restaurant/categories')
    const data = validateSchema(CreateCategorySchema, req.body)
    const item = await this.service.createCategory(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateCategory(req: HttpRequest) {
    this.logger.info('PUT /restaurant/categories/:id', { id: req.params.id })
    const data = validateSchema(UpdateCategorySchema, req.body)
    const item = await this.service.updateCategory(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroyCategory(req: HttpRequest) {
    this.logger.info('DELETE /restaurant/categories/:id', { id: req.params.id })
    await this.service.deleteCategory(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Carta: ítems (RES-1) ───
  async indexItems(req: HttpRequest) {
    this.logger.info('GET /restaurant/menu-items')
    const categoryId = (req.query as any)?.categoryId as string | undefined
    return { status: 200, body: await this.service.listItems(categoryId, req.user as any) }
  }
  async showItem(req: HttpRequest) {
    const item = await this.service.getItem(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async storeItem(req: HttpRequest) {
    this.logger.info('POST /restaurant/menu-items')
    const data = validateSchema(CreateItemSchema, req.body)
    const item = await this.service.createItem(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateItem(req: HttpRequest) {
    this.logger.info('PUT /restaurant/menu-items/:id', { id: req.params.id })
    const data = validateSchema(UpdateItemSchema, req.body)
    const item = await this.service.updateItem(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async setItemAvailability(req: HttpRequest) {
    this.logger.info('PUT /restaurant/menu-items/:id/availability', { id: req.params.id })
    const data = validateSchema(AvailabilitySchema, req.body) as any
    const item = await this.service.setItemAvailability(req.params.id, data.available, req.user as any)
    return { status: 200, body: item }
  }
  async destroyItem(req: HttpRequest) {
    this.logger.info('DELETE /restaurant/menu-items/:id', { id: req.params.id })
    await this.service.deleteItem(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Mesas (RES-2) ───
  async indexTables(req: HttpRequest) {
    this.logger.info('GET /restaurant/tables')
    return { status: 200, body: await this.service.listTables(req.user as any) }
  }
  async showTable(req: HttpRequest) {
    const item = await this.service.getTable(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async storeTable(req: HttpRequest) {
    this.logger.info('POST /restaurant/tables')
    const data = validateSchema(CreateTableSchema, req.body)
    const item = await this.service.createTable(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateTable(req: HttpRequest) {
    this.logger.info('PUT /restaurant/tables/:id', { id: req.params.id })
    const data = validateSchema(UpdateTableSchema, req.body)
    const item = await this.service.updateTable(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroyTable(req: HttpRequest) {
    this.logger.info('DELETE /restaurant/tables/:id', { id: req.params.id })
    await this.service.deleteTable(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Comandas (RES-3) ───
  async indexOrders(req: HttpRequest) {
    this.logger.info('GET /restaurant/orders')
    const q = req.query as any
    return { status: 200, body: await this.service.listOrders({ status: q?.status, tableId: q?.tableId }, req.user as any) }
  }
  async showOrder(req: HttpRequest) {
    const item = await this.service.getOrder(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async openOrder(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders')
    const data = validateSchema(OpenOrderSchema, req.body)
    const item = await this.service.openOrder(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async sendOrder(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders/:id/send', { id: req.params.id })
    const item = await this.service.sendOrder(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async cancelOrder(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders/:id/cancel', { id: req.params.id })
    const item = await this.service.cancelOrder(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async addLine(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders/:id/items', { id: req.params.id })
    const data = validateSchema(AddLineSchema, req.body)
    const item = await this.service.addLine(req.params.id, data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateLine(req: HttpRequest) {
    this.logger.info('PUT /restaurant/orders/:id/items/:lineId', { id: req.params.id, lineId: req.params.lineId })
    const data = validateSchema(UpdateLineSchema, req.body)
    const item = await this.service.updateLine(req.params.id, req.params.lineId, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async removeLine(req: HttpRequest) {
    this.logger.info('DELETE /restaurant/orders/:id/items/:lineId', { id: req.params.id, lineId: req.params.lineId })
    await this.service.removeLine(req.params.id, req.params.lineId, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Cuenta + cobro (RES-5) ───
  async billOrder(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders/:id/bill', { id: req.params.id })
    const data = validateSchema(BillSchema, req.body)
    const item = await this.service.billOrder(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async chargeToRoom(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders/:id/charge-to-room', { id: req.params.id })
    const data = validateSchema(ChargeToRoomSchema, req.body)
    const item = await this.service.chargeToRoom(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async payOrder(req: HttpRequest) {
    this.logger.info('POST /restaurant/orders/:id/pay', { id: req.params.id })
    const data = validateSchema(PaySchema, req.body)
    const item = await this.service.payOrder(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
}
