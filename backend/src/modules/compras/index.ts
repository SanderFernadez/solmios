// compras/index.ts — PUERTA PÚBLICA del módulo de compras. ⚠ Append-only.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerComprasModels } from './model'
import { ComprasService } from './service'
import { ComprasController } from './controller'
import type {
  RequisitionDTO, RequisitionItemDTO, PurchaseOrderDTO, PurchaseOrderItemDTO, GoodsReceiptDTO, ReceiptItemDTO,
} from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { ComprasService }
export type {
  RequisitionDTO, PurchaseOrderDTO, PurchaseOrderItemDTO, GoodsReceiptDTO, ReceiptItemDTO,
  RequisitionStatus, PurchaseOrderStatus, ComprasPorts,
} from './types'
export type { ComprasSockets } from './sockets'
export { registerComprasModels } from './model'

export function ComprasModule() {
  return createModule({
    name: 'compras',
    version: '1.0.0',
    description: 'Compras: requisiciones, órdenes de compra, recepción de mercancía (genera gasto)',

    contract: {
      name: 'compras',
      version: '1.0.0',
      description: 'Compras (procurement)',
      actions: ['listOrders', 'createOrder', 'receive', 'markInvoiced'],
      events: ['onOrderReceived', 'onGoodsReceived'],
      tables: ['purchase_requisitions', 'requisition_items', 'purchase_orders', 'purchase_order_items', 'goods_receipts', 'receipt_items'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'hotelId del JWT (multi-tenant)', 'Proveedores/stock/gasto por puertos (connector)'],
    },

    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('compras: auth dependency required')
      registerComprasModels(orm)

      const requisitions = new OrmRepository<RequisitionDTO>(orm, 'PurchaseRequisitions')
      const reqItems = new OrmRepository<RequisitionItemDTO>(orm, 'RequisitionItems')
      const orders = new OrmRepository<PurchaseOrderDTO>(orm, 'PurchaseOrders')
      const orderItems = new OrmRepository<PurchaseOrderItemDTO>(orm, 'PurchaseOrderItems')
      const receipts = new OrmRepository<GoodsReceiptDTO>(orm, 'GoodsReceipts')
      const receiptItems = new OrmRepository<ReceiptItemDTO>(orm, 'ReceiptItems')
      const config = new OrmRepository<any>(orm, 'Configuration')
      const hotels = new OrmRepository<any>(orm, 'Hotels')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('compras')
      const service = new ComprasService(requisitions, reqItems, orders, orderItems, receipts, receiptItems, config, hotels, userRepo, log, auth)
      const controller = new ComprasController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('purchasing')]

      // Requisiciones (COM-1)
      router.get('/api/compras/requisitions', guard('purchasing', 'view'), (req) => controller.indexReq(req))
      router.get('/api/compras/requisitions/:id', guard('purchasing', 'view'), (req) => controller.showReq(req))
      router.post('/api/compras/requisitions', guard('purchasing', 'create'), (req) => controller.storeReq(req))
      router.post('/api/compras/requisitions/:id/items', guard('purchasing', 'create'), (req) => controller.addReqLine(req))
      router.delete('/api/compras/requisitions/:id/items/:lineId', guard('purchasing', 'edit'), (req) => controller.removeReqLine(req))
      router.post('/api/compras/requisitions/:id/transition', guard('purchasing', 'edit'), (req) => controller.transitionReq(req))
      // Enviar la PROPIA requisición a aprobación: gateado por 'create' (no 'edit'), segregación de
      // funciones quien-pide≠quien-aprueba. Restringido al creador dentro del usecase (submitOwn).
      router.post('/api/compras/requisitions/:id/submit', guard('purchasing', 'create'), (req) => controller.submitReq(req))
      router.delete('/api/compras/requisitions/:id', guard('purchasing', 'delete'), (req) => controller.destroyReq(req))

      // Órdenes de compra (COM-2)
      router.get('/api/compras/orders', guard('purchasing', 'view'), (req) => controller.indexOrder(req))
      router.get('/api/compras/orders/:id', guard('purchasing', 'view'), (req) => controller.showOrder(req))
      router.post('/api/compras/orders', guard('purchasing', 'create'), (req) => controller.storeOrder(req))
      router.post('/api/compras/orders/:id/items', guard('purchasing', 'create'), (req) => controller.addOrderLine(req))
      router.delete('/api/compras/orders/:id/items/:lineId', guard('purchasing', 'edit'), (req) => controller.removeOrderLine(req))
      router.post('/api/compras/orders/:id/transition', guard('purchasing', 'edit'), (req) => controller.transitionOrder(req))

      // Recepción + facturación (COM-3/4)
      router.get('/api/compras/orders/:id/receipts', guard('purchasing', 'view'), (req) => controller.listReceipts(req))
      router.post('/api/compras/orders/:id/receive', guard('purchasing', 'edit'), (req) => controller.receive(req))
      router.post('/api/compras/orders/:id/invoice', guard('purchasing', 'edit'), (req) => controller.invoice(req))

      log.info('Módulo compras listo')
      return service
    },
  })
}
