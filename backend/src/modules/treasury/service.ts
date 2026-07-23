// treasury/service.ts — Facade del módulo de tesorería. Solo orquesta: la lógica vive en usecases/.
// Reportes de liquidez (cash flow / AR / AP) leen tablas existentes (payments/expenses/invoices) por
// hotelId — patrón del módulo reports. Proveedores tienen su CRUD. NO importa de otros módulos.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type { CreateSupplierDTO, UpdateSupplierDTO, CurrentUser, SupplierDTO } from './types'
import { cashFlow, receivables, payables, type LiquidityDeps } from './usecases/liquidity'
import * as suppliersCrud from './usecases/suppliers-crud'

export class TreasuryService {
  constructor(
    private readonly suppliers: RepositoryAdapter<SupplierDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly logger: Logger,
    // Tablas de otros módulos leídas de forma read-only para los reportes (patrón reports).
    private readonly payments: RepositoryAdapter<any>,
    private readonly expenses: RepositoryAdapter<any>,
    private readonly invoices: RepositoryAdapter<any>,
  ) {}

  private hotelFor(user: CurrentUser): string {
    const h = user.hotelId || ''
    if (!h && user.role !== 'super_admin') throw new Error('Sin hotel asignado')
    return h
  }
  private liquidityDeps(): LiquidityDeps {
    return { payments: this.payments, expenses: this.expenses, invoices: this.invoices }
  }
  private suppliersDeps() {
    return { suppliers: this.suppliers, userRepo: this.userRepo, auth: this.auth }
  }

  // ─── Liquidez (TES-2/3/4) ───
  cashFlow(from: string | undefined, to: string | undefined, group: 'day' | 'month', user: CurrentUser) {
    return cashFlow(this.liquidityDeps(), this.hotelFor(user), from, to, group)
  }
  receivables(user: CurrentUser) { return receivables(this.liquidityDeps(), this.hotelFor(user)) }
  payables(user: CurrentUser) { return payables(this.liquidityDeps(), this.hotelFor(user)) }

  // ─── Proveedores (TES-4) ───
  listSuppliers(user: CurrentUser) { return suppliersCrud.listSuppliers(this.suppliersDeps(), user) }
  createSupplier(dto: CreateSupplierDTO, user: CurrentUser) { return suppliersCrud.createSupplier(this.suppliersDeps(), dto, user) }
  updateSupplier(id: string, dto: UpdateSupplierDTO, user: CurrentUser) { return suppliersCrud.updateSupplier(this.suppliersDeps(), id, dto, user) }
  deleteSupplier(id: string, user: CurrentUser) { return suppliersCrud.deleteSupplier(this.suppliersDeps(), id, user) }
}
