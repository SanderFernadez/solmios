// inventario/index.ts — PUERTA PÚBLICA del módulo de inventario. ⚠ Append-only.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerInventarioModels } from './model'
import { InventarioService } from './service'
import { InventarioController } from './controller'
import type { InventoryItemDTO, StockMovementDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { InventarioService }
export type { InventoryItemDTO, StockMovementDTO, ItemCategory, MovementType, MovementSource } from './types'
export type { InventarioSockets } from './sockets'
export type { ApplyMovementInput } from './usecases/movements'
export { registerInventarioModels } from './model'

export function InventarioModule() {
  return createModule({
    name: 'inventario',
    version: '1.0.0',
    description: 'Inventario de insumos (comida/bebida/bar/suministro): stock, costo promedio, movimientos',

    contract: {
      name: 'inventario',
      version: '1.0.0',
      description: 'Inventario de insumos',
      actions: ['listItems', 'getItem', 'createItem', 'updateItem', 'deleteItem', 'moveStock'],
      events: ['onStockChanged'],
      tables: ['inventory_items', 'stock_movements'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'hotelId del JWT (multi-tenant)', 'Stock solo por ledger (idempotente)'],
    },

    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('inventario: auth dependency required')
      registerInventarioModels(orm)

      const items = new OrmRepository<InventoryItemDTO>(orm, 'InventoryItems')
      const movements = new OrmRepository<StockMovementDTO>(orm, 'StockMovements')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('inventario')
      const service = new InventarioService(items, movements, userRepo, log, auth)
      const controller = new InventarioController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('inventory')]

      // Insumos (INV-1)
      router.get('/api/inventario/items', guard('inventory', 'view'), (req) => controller.index(req))
      router.get('/api/inventario/valuation', guard('inventory', 'view'), (req) => controller.valuation(req))
      router.get('/api/inventario/items/:id', guard('inventory', 'view'), (req) => controller.show(req))
      router.post('/api/inventario/items', guard('inventory', 'create'), (req) => controller.store(req))
      router.put('/api/inventario/items/:id', guard('inventory', 'edit'), (req) => controller.update(req))
      router.delete('/api/inventario/items/:id', guard('inventory', 'delete'), (req) => controller.destroy(req))

      // Ledger de stock (INV-2)
      router.get('/api/inventario/items/:id/movements', guard('inventory', 'view'), (req) => controller.movements(req))
      router.post('/api/inventario/items/:id/movements', guard('inventory', 'edit'), (req) => controller.move(req))

      log.info('Módulo inventario listo')
      return service
    },
  })
}
