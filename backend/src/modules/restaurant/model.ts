// restaurant/model.ts — Schema del POS de restaurante (RES-0).
// 6 tablas: estaciones (pantallas KDS configurables), carta (menu_categories + menu_items),
// salón (restaurant_tables), y comandas (restaurant_orders + restaurant_order_items).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, booleanos = INTEGER 0/1.
// Ver openspec/changes/restaurante-pos/design.md §Modelo de datos.
import type { ModelDefinition, ORM } from 'arckode-framework'

/** Estación de preparación = una pantalla KDS. Configurable por hotel (Cocina, Bar, Parrilla…). */
export const RestaurantStationModel: ModelDefinition = {
  table: 'restaurant_stations',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    active: { type: 'number', default: 1 },
    sortOrder: { type: 'number', default: 0 },
  },
  timestamps: true,
}

/** Categoría de la carta. `stationId` rutea sus ítems a una pantalla KDS. */
export const MenuCategoryModel: ModelDefinition = {
  table: 'menu_categories',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    // FK lógica a restaurant_stations. Los ítems de la categoría van a esa pantalla. Null = sin ruteo.
    stationId: { type: 'string', indexed: true },
    sortOrder: { type: 'number', default: 0 },
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

/** Ítem de la carta. `price` es NETO (sin impuesto; se aplica al facturar, como folio_charges). */
export const MenuItemModel: ModelDefinition = {
  table: 'menu_items',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    categoryId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    description: { type: 'text' },
    price: { type: 'number', required: true },
    // Si null → tasa de configuration('taxes') del hotel al facturar (NO hardcode).
    taxRate: { type: 'number' },
    // Override opcional de estación. Si null → hereda category.stationId.
    stationId: { type: 'string', indexed: true },
    available: { type: 'number', default: 1 },
    imageUrl: { type: 'string' },
    sortOrder: { type: 'number', default: 0 },
  },
  timestamps: true,
}

/** Mesa del salón. `status` se cachea a partir de la comanda abierta. */
export const RestaurantTableModel: ModelDefinition = {
  table: 'restaurant_tables',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    zone: { type: 'string' },
    capacity: { type: 'number', default: 0 },
    // free | occupied | reserved
    status: { type: 'string', default: 'free' },
  },
  timestamps: true,
}

/** Comanda / cuenta. Los totales los calcula el server; `settlement` = folio XOR payment (una sola vez). */
export const RestaurantOrderModel: ModelDefinition = {
  table: 'restaurant_orders',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    number: { type: 'string' },   // correlativo por hotel (counter atómico en configuration)
    // dine_in | room_service | takeaway
    type: { type: 'string', required: true },
    tableId: { type: 'string', indexed: true },
    reservationId: { type: 'string', indexed: true },
    guestId: { type: 'string' },
    roomId: { type: 'string' },
    waiterId: { type: 'string', indexed: true },   // users.id (nombre se resuelve por /usuarios)
    // open | sent | preparing | ready | served | billed | charged | paid | cancelled
    status: { type: 'string', default: 'open' },
    subtotal: { type: 'number', default: 0 },
    tax: { type: 'number', default: 0 },
    tip: { type: 'number', default: 0 },
    total: { type: 'number', default: 0 },
    // folio | payment | null — cómo se liquidó (mutuamente excluyente)
    settlement: { type: 'string' },
    folioId: { type: 'string' },
    paymentId: { type: 'string' },
    openedAt: { type: 'string' },
    closedAt: { type: 'string' },
  },
  timestamps: true,
}

/** Línea de la comanda. Snapshot de name/price/estación: la comanda no muta si cambia la carta. */
export const RestaurantOrderItemModel: ModelDefinition = {
  table: 'restaurant_order_items',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    orderId: { type: 'string', required: true, indexed: true },
    menuItemId: { type: 'string', indexed: true },
    name: { type: 'string', required: true },      // snapshot
    unitPrice: { type: 'number', required: true }, // snapshot (neto)
    quantity: { type: 'number', default: 1 },
    notes: { type: 'text' },
    // Tasa de impuesto (%) congelada al agregar la línea (item.taxRate ?? tasa del hotel). Snapshot:
    // la cuenta no cambia si después se reconfigura el impuesto del hotel. NO hardcodeada.
    taxRate: { type: 'number', default: 0 },
    // Estación resuelta y congelada (item.stationId ?? category.stationId ?? 1ª activa).
    stationId: { type: 'string', indexed: true },
    stationName: { type: 'string' },   // snapshot: sobrevive si la estación se borra
    // new | preparing | ready | served | cancelled (ciclo KDS por línea)
    status: { type: 'string', default: 'new' },
    lineTotal: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerRestaurantModels(orm: ORM): void {
  orm.define('RestaurantStations', RestaurantStationModel)
  orm.define('MenuCategories', MenuCategoryModel)
  orm.define('MenuItems', MenuItemModel)
  orm.define('RestaurantTables', RestaurantTableModel)
  orm.define('RestaurantOrders', RestaurantOrderModel)
  orm.define('RestaurantOrderItems', RestaurantOrderItemModel)
}
