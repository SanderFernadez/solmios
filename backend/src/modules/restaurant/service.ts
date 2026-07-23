// restaurant/service.ts — Facade del módulo POS de restaurante. Orquesta; la lógica que crece vive en
// usecases/. Depende de RepositoryAdapter, NO del ORM directo. NO importa de otros módulos (eso va por
// conectores). RES-0: estaciones (inline). RES-1: carta (categorías + ítems, usecases). RES-2: mesas
// (usecases). Sprints siguientes agregan comandas, KDS y cobro. Ver openspec/changes/restaurante-pos.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { StationDTO, CategoryDTO, MenuItemDTO, TableDTO, OrderDTO, OrderItemDTO, CurrentUser } from './types'
import type { RestaurantSockets } from './sockets'
import * as categoriesCrud from './usecases/categories-crud'
import * as itemsCrud from './usecases/items-crud'
import * as tablesCrud from './usecases/tables-crud'
import * as orders from './usecases/orders'
import * as orderLines from './usecases/order-lines'
import * as settlement from './usecases/settlement'

export class RestaurantService {
  private sockets: RestaurantSockets = {}
  // Puertos de liquidación (folios/payments) que inyecta un conector. RES-5.
  private settlementPorts: settlement.SettlementPorts = {}

  constructor(
    private readonly stations: RepositoryAdapter<StationDTO>,
    private readonly categories: RepositoryAdapter<CategoryDTO>,
    private readonly items: RepositoryAdapter<MenuItemDTO>,
    private readonly tables: RepositoryAdapter<TableDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth: Auth,
    // RES-3: comandas. Opcionales para no romper tests que solo ejercitan carta/mesas.
    private readonly orders?: RepositoryAdapter<OrderDTO>,
    private readonly lines?: RepositoryAdapter<OrderItemDTO>,
    private readonly config?: RepositoryAdapter<any>,
    private readonly hotels?: RepositoryAdapter<any>,
  ) {}

  // Acumula handlers, nunca pisa el anterior (composición de sockets).
  setSockets(s: Partial<RestaurantSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  /** Puertos de liquidación (folios/payments) inyectados por conector. Acumula (no pisa). */
  setSettlementDeps(p: Partial<settlement.SettlementPorts>): void {
    this.settlementPorts = { ...this.settlementPorts, ...p }
  }

  /** hotelId SIEMPRE del JWT (nunca del body) — anti-IDOR multi-tenant. */
  private hotelFor(user: CurrentUser): string {
    const h = user.hotelId || ''
    if (!h) throw new ValidationError('Sin hotel asignado')
    return h
  }

  private catDeps(): categoriesCrud.CategoriesCrudDeps {
    return { categories: this.categories, items: this.items, stations: this.stations, userRepo: this.userRepo, auth: this.auth }
  }
  private itemDeps(): itemsCrud.ItemsCrudDeps {
    return { items: this.items, categories: this.categories, stations: this.stations, userRepo: this.userRepo, auth: this.auth }
  }
  private tableDeps(): tablesCrud.TablesCrudDeps {
    return { tables: this.tables, userRepo: this.userRepo, auth: this.auth }
  }
  private ordersDeps(): orders.OrdersDeps {
    if (!this.orders || !this.lines || !this.config) throw new ValidationError('Comandas no configuradas')
    return { orders: this.orders, lines: this.lines, tables: this.tables, config: this.config, userRepo: this.userRepo, auth: this.auth, sockets: this.sockets }
  }
  private orderLinesDeps(): orderLines.OrderLinesDeps {
    if (!this.orders || !this.lines || !this.config || !this.hotels) throw new ValidationError('Comandas no configuradas')
    return { orders: this.orders, lines: this.lines, items: this.items, categories: this.categories, stations: this.stations, config: this.config, hotels: this.hotels, userRepo: this.userRepo, auth: this.auth }
  }
  private settlementDeps(): settlement.SettlementDeps {
    if (!this.orders || !this.lines || !this.hotels) throw new ValidationError('Comandas no configuradas')
    return { orders: this.orders, lines: this.lines, tables: this.tables, hotels: this.hotels, userRepo: this.userRepo, auth: this.auth, sockets: this.sockets, ports: this.settlementPorts }
  }

  // ─── Estaciones (RES-0) — pantallas KDS configurables por hotel ───
  async listStations(user: CurrentUser): Promise<{ data: StationDTO[]; total: number }> {
    const data = await this.stations.findMany({ hotelId: this.hotelFor(user) })
    data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    return { data, total: data.length }
  }

  async getStation(id: string, user: CurrentUser): Promise<StationDTO> {
    const item = await this.stations.findById(id)
    if (!item) throw new NotFoundError('Estación no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async createStation(dto: { name: string; active?: number; sortOrder?: number }, user: CurrentUser): Promise<StationDTO> {
    const hotelId = this.hotelFor(user)
    if (!dto.name?.trim()) throw new ValidationError('El nombre de la estación es obligatorio')
    return this.stations.create({
      hotelId,
      name: dto.name.trim(),
      active: dto.active ?? 1,
      sortOrder: dto.sortOrder ?? 0,
    } as Omit<StationDTO, 'id'>)
  }

  async updateStation(id: string, dto: { name?: string; active?: number; sortOrder?: number }, user: CurrentUser): Promise<StationDTO> {
    const existing = await this.stations.findById(id)
    if (!existing) throw new NotFoundError('Estación no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.stations.update(id, dto as Partial<Omit<StationDTO, 'id'>>)
    if (!item) throw new NotFoundError('Estación no encontrada')
    return item
  }

  async deleteStation(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.stations.findById(id)
    if (!existing) throw new NotFoundError('Estación no encontrada')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    // Las categorías/ítems que la referencian caen al fallback de ruteo (1ª estación activa / "Sin estación").
    const deleted = await this.stations.delete(id)
    if (!deleted) throw new NotFoundError('Estación no encontrada')
  }

  // ─── Carta: categorías (RES-1) — delegan a usecases/categories-crud ───
  listCategories(user: CurrentUser) { return categoriesCrud.listCategories(this.catDeps(), user) }
  getCategory(id: string, user: CurrentUser) { return categoriesCrud.getCategory(this.catDeps(), id, user) }
  createCategory(dto: categoriesCrud.CreateCategoryInput, user: CurrentUser) { return categoriesCrud.createCategory(this.catDeps(), dto, user) }
  updateCategory(id: string, dto: categoriesCrud.UpdateCategoryInput, user: CurrentUser) { return categoriesCrud.updateCategory(this.catDeps(), id, dto, user) }
  deleteCategory(id: string, user: CurrentUser) { return categoriesCrud.deleteCategory(this.catDeps(), id, user) }

  // ─── Carta: ítems (RES-1) — delegan a usecases/items-crud ───
  listItems(categoryId: string | undefined, user: CurrentUser) { return itemsCrud.listItems(this.itemDeps(), categoryId, user) }
  getItem(id: string, user: CurrentUser) { return itemsCrud.getItem(this.itemDeps(), id, user) }
  createItem(dto: itemsCrud.CreateItemInput, user: CurrentUser) { return itemsCrud.createItem(this.itemDeps(), dto, user) }
  updateItem(id: string, dto: itemsCrud.UpdateItemInput, user: CurrentUser) { return itemsCrud.updateItem(this.itemDeps(), id, dto, user) }
  setItemAvailability(id: string, available: number | undefined, user: CurrentUser) { return itemsCrud.setAvailability(this.itemDeps(), id, available, user) }
  deleteItem(id: string, user: CurrentUser) { return itemsCrud.deleteItem(this.itemDeps(), id, user) }

  // ─── Mesas (RES-2) — delegan a usecases/tables-crud ───
  listTables(user: CurrentUser) { return tablesCrud.listTables(this.tableDeps(), user) }
  getTable(id: string, user: CurrentUser) { return tablesCrud.getTable(this.tableDeps(), id, user) }
  createTable(dto: tablesCrud.CreateTableInput, user: CurrentUser) { return tablesCrud.createTable(this.tableDeps(), dto, user) }
  updateTable(id: string, dto: tablesCrud.UpdateTableInput, user: CurrentUser) { return tablesCrud.updateTable(this.tableDeps(), id, dto, user) }
  deleteTable(id: string, user: CurrentUser) { return tablesCrud.deleteTable(this.tableDeps(), id, user) }

  // ─── Comandas (RES-3) — delegan a usecases/orders + usecases/order-lines ───
  openOrder(dto: orders.OpenOrderInput, user: CurrentUser) { return orders.openOrder(this.ordersDeps(), dto, user) }
  listOrders(query: { status?: string; tableId?: string } | undefined, user: CurrentUser) { return orders.listOrders(this.ordersDeps(), query, user) }
  getOrder(id: string, user: CurrentUser) { return orders.getOrder(this.ordersDeps(), id, user) }
  sendOrder(id: string, user: CurrentUser) { return orders.sendOrder(this.ordersDeps(), id, user) }
  cancelOrder(id: string, user: CurrentUser) { return orders.cancelOrder(this.ordersDeps(), id, user) }
  addLine(orderId: string, dto: orderLines.AddLineInput, user: CurrentUser) { return orderLines.addLine(this.orderLinesDeps(), orderId, dto, user) }
  updateLine(orderId: string, lineId: string, dto: orderLines.UpdateLineInput, user: CurrentUser) { return orderLines.updateLine(this.orderLinesDeps(), orderId, lineId, dto, user) }
  removeLine(orderId: string, lineId: string, user: CurrentUser) { return orderLines.removeLine(this.orderLinesDeps(), orderId, lineId, user) }

  // ─── Cuenta + cobro (RES-5) — delegan a usecases/settlement ───
  billOrder(id: string, dto: { tip?: number }, user: CurrentUser) { return settlement.billOrder(this.settlementDeps(), id, dto, user) }
  chargeToRoom(id: string, dto: { reservationId?: string }, user: CurrentUser) { return settlement.chargeToRoom(this.settlementDeps(), id, dto, user) }
  payOrder(id: string, dto: { method: string }, user: CurrentUser) { return settlement.payOrder(this.settlementDeps(), id, dto, user) }
}
