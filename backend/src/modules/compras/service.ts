// compras/service.ts — Facade del módulo de compras. Orquesta; la lógica vive en usecases/. Depende de
// RepositoryAdapter (NO del ORM directo). NO importa de otros módulos: proveedores (treasury), stock
// (inventario) y gasto (gastos) entran por PUERTOS que inyecta un conector (setPorts).
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type {
  RequisitionDTO, RequisitionItemDTO, PurchaseOrderDTO, PurchaseOrderItemDTO,
  GoodsReceiptDTO, ReceiptItemDTO, ComprasPorts, RequisitionStatus, PurchaseOrderStatus, CurrentUser,
} from './types'
import * as reqUc from './usecases/requisitions'
import * as ordUc from './usecases/orders'
import * as recUc from './usecases/receipts'

export class ComprasService {
  private ports: ComprasPorts = {}

  constructor(
    private readonly requisitions: RepositoryAdapter<RequisitionDTO>,
    private readonly reqItems: RepositoryAdapter<RequisitionItemDTO>,
    private readonly orders: RepositoryAdapter<PurchaseOrderDTO>,
    private readonly orderItems: RepositoryAdapter<PurchaseOrderItemDTO>,
    private readonly receipts: RepositoryAdapter<GoodsReceiptDTO>,
    private readonly receiptItems: RepositoryAdapter<ReceiptItemDTO>,
    private readonly config: RepositoryAdapter<any>,
    private readonly hotels: RepositoryAdapter<any>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth: Auth,
  ) {}

  /** Puertos (proveedores/stock/gasto) inyectados por conector. Acumula (no pisa). */
  setPorts(p: Partial<ComprasPorts>): void { this.ports = { ...this.ports, ...p } }

  private reqDeps(): reqUc.RequisitionDeps {
    return { requisitions: this.requisitions, reqItems: this.reqItems, config: this.config, userRepo: this.userRepo, auth: this.auth }
  }
  private ordDeps(): ordUc.OrdersDeps {
    return { orders: this.orders, orderItems: this.orderItems, requisitions: this.requisitions, reqItems: this.reqItems, config: this.config, hotels: this.hotels, userRepo: this.userRepo, auth: this.auth, ports: this.ports }
  }
  private recDeps(): recUc.ReceiptsDeps {
    return { orders: this.orders, orderItems: this.orderItems, receipts: this.receipts, receiptItems: this.receiptItems, config: this.config, userRepo: this.userRepo, auth: this.auth, ports: this.ports }
  }

  // ─── Requisiciones (COM-1) ───
  listRequisitions(q: { status?: string } | undefined, user: CurrentUser) { return reqUc.listRequisitions(this.reqDeps(), q, user) }
  getRequisition(id: string, user: CurrentUser) { return reqUc.getRequisition(this.reqDeps(), id, user) }
  createRequisition(dto: reqUc.CreateRequisitionInput, user: CurrentUser) { return reqUc.createRequisition(this.reqDeps(), dto, user) }
  addRequisitionLine(id: string, l: reqUc.RequisitionLineInput, user: CurrentUser) { return reqUc.addLine(this.reqDeps(), id, l, user) }
  removeRequisitionLine(id: string, lineId: string, user: CurrentUser) { return reqUc.removeLine(this.reqDeps(), id, lineId, user) }
  transitionRequisition(id: string, to: RequisitionStatus, user: CurrentUser) { return reqUc.transition(this.reqDeps(), id, to, user) }
  /** Enviar la propia requisición a aprobación — gateada por `purchasing:create` en la ruta (COM-1). */
  submitRequisition(id: string, user: CurrentUser) { return reqUc.submitOwn(this.reqDeps(), id, user) }
  deleteRequisition(id: string, user: CurrentUser) { return reqUc.deleteRequisition(this.reqDeps(), id, user) }

  // ─── Órdenes de compra (COM-2) ───
  listOrders(q: { status?: string; supplierId?: string } | undefined, user: CurrentUser) { return ordUc.listOrders(this.ordDeps(), q, user) }
  getOrder(id: string, user: CurrentUser) { return ordUc.getOrder(this.ordDeps(), id, user) }
  createOrder(dto: ordUc.CreateOrderInput, user: CurrentUser) { return ordUc.createOrder(this.ordDeps(), dto, user) }
  addOrderLine(id: string, l: ordUc.OrderLineInput, user: CurrentUser) { return ordUc.addLine(this.ordDeps(), id, l, user) }
  removeOrderLine(id: string, lineId: string, user: CurrentUser) { return ordUc.removeLine(this.ordDeps(), id, lineId, user) }
  transitionOrder(id: string, to: PurchaseOrderStatus, user: CurrentUser) { return ordUc.transition(this.ordDeps(), id, to, user) }

  // ─── Recepción + facturación (COM-3/4) ───
  receive(orderId: string, dto: recUc.ReceiveInput, user: CurrentUser) { return recUc.receive(this.recDeps(), orderId, dto, user) }
  listReceipts(orderId: string, user: CurrentUser) { return recUc.listReceipts(this.recDeps(), orderId, user) }
  markInvoiced(orderId: string, dto: { invoiceNumber?: string }, user: CurrentUser) { return recUc.markInvoiced(this.recDeps(), orderId, dto, user) }
}
