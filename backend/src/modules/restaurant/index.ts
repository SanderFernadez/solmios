// restaurant/index.ts — PUERTA PÚBLICA del módulo POS de restaurante.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerRestaurantModels } from './model'
import { RestaurantService } from './service'
import { RestaurantController } from './controller'
import type { StationDTO, CategoryDTO, MenuItemDTO, TableDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { RestaurantService }
export type {
  StationDTO, CategoryDTO, MenuItemDTO, TableDTO, OrderDTO, OrderItemDTO,
  OrderType, OrderStatus, LineStatus, TableStatus, Settlement,
} from './types'
export type { RestaurantSockets } from './sockets'
export { RestaurantValidator, CreateStationSchema, UpdateStationSchema } from './validators/schema'
export { registerRestaurantModels } from './model'

export function RestaurantModule() {
  return createModule({
    name: 'restaurant',
    version: '1.0.0',
    description: 'POS de restaurante (estaciones/KDS, carta, mesas, comandas, cuenta)',

    contract: {
      name: 'restaurant',
      version: '1.0.0',
      description: 'POS de restaurante',
      actions: ['listStations', 'getStation', 'createStation', 'updateStation', 'deleteStation'],
      events: ['onOrderSent', 'onLineStatusChanged', 'onOrderCharged', 'onOrderPaid'],
      tables: [
        'restaurant_stations', 'menu_categories', 'menu_items',
        'restaurant_tables', 'restaurant_orders', 'restaurant_order_items',
      ],
      dependencies: [],
      rules: ['No importar de otros módulos', 'hotelId del JWT (multi-tenant)', 'Estaciones configurables (no hardcode)'],
    },

    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('restaurant: auth dependency required')
      registerRestaurantModels(orm)

      const stations = new OrmRepository<StationDTO>(orm, 'RestaurantStations')
      const categories = new OrmRepository<CategoryDTO>(orm, 'MenuCategories')
      const items = new OrmRepository<MenuItemDTO>(orm, 'MenuItems')
      const tables = new OrmRepository<TableDTO>(orm, 'RestaurantTables')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('restaurant')
      const service = new RestaurantService(stations, categories, items, tables, userRepo, log, auth)
      const controller = new RestaurantController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('restaurant')]

      // Estaciones (pantallas KDS configurables) — RES-0
      router.get('/api/restaurant/stations', guard('restaurant', 'view'), (req) => controller.indexStations(req))
      router.get('/api/restaurant/stations/:id', guard('restaurant', 'view'), (req) => controller.showStation(req))
      router.post('/api/restaurant/stations', guard('restaurant', 'create'), (req) => controller.storeStation(req))
      router.put('/api/restaurant/stations/:id', guard('restaurant', 'edit'), (req) => controller.updateStation(req))
      router.delete('/api/restaurant/stations/:id', guard('restaurant', 'delete'), (req) => controller.destroyStation(req))

      // Carta: categorías (RES-1)
      router.get('/api/restaurant/categories', guard('restaurant', 'view'), (req) => controller.indexCategories(req))
      router.get('/api/restaurant/categories/:id', guard('restaurant', 'view'), (req) => controller.showCategory(req))
      router.post('/api/restaurant/categories', guard('restaurant', 'create'), (req) => controller.storeCategory(req))
      router.put('/api/restaurant/categories/:id', guard('restaurant', 'edit'), (req) => controller.updateCategory(req))
      router.delete('/api/restaurant/categories/:id', guard('restaurant', 'delete'), (req) => controller.destroyCategory(req))

      // Carta: ítems (RES-1)
      router.get('/api/restaurant/menu-items', guard('restaurant', 'view'), (req) => controller.indexItems(req))
      router.get('/api/restaurant/menu-items/:id', guard('restaurant', 'view'), (req) => controller.showItem(req))
      router.post('/api/restaurant/menu-items', guard('restaurant', 'create'), (req) => controller.storeItem(req))
      router.put('/api/restaurant/menu-items/:id', guard('restaurant', 'edit'), (req) => controller.updateItem(req))
      router.put('/api/restaurant/menu-items/:id/availability', guard('restaurant', 'edit'), (req) => controller.setItemAvailability(req))
      router.delete('/api/restaurant/menu-items/:id', guard('restaurant', 'delete'), (req) => controller.destroyItem(req))

      // Mesas / salón (RES-2)
      router.get('/api/restaurant/tables', guard('restaurant', 'view'), (req) => controller.indexTables(req))
      router.get('/api/restaurant/tables/:id', guard('restaurant', 'view'), (req) => controller.showTable(req))
      router.post('/api/restaurant/tables', guard('restaurant', 'create'), (req) => controller.storeTable(req))
      router.put('/api/restaurant/tables/:id', guard('restaurant', 'edit'), (req) => controller.updateTable(req))
      router.delete('/api/restaurant/tables/:id', guard('restaurant', 'delete'), (req) => controller.destroyTable(req))

      log.info('Módulo restaurant listo')
      return service
    },
  })
}
