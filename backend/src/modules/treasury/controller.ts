// treasury/controller.ts — Adaptador HTTP. Traduce request → service → response. Sin lógica ni ORM.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { TreasuryService } from './service'
import {
  CreateSupplierSchema, UpdateSupplierSchema,
  CreateBankAccountSchema, UpdateBankAccountSchema, CreateBudgetSchema, UpdateBudgetSchema,
} from './validators/schema'

export class TreasuryController {
  constructor(private readonly service: TreasuryService, private readonly logger: Logger) {}

  async cashFlow(req: HttpRequest) {
    const q = req.query as any
    const group = q?.group === 'day' ? 'day' : 'month'
    return { status: 200, body: await this.service.cashFlow(q?.from, q?.to, group, req.user as any) }
  }
  async receivables(req: HttpRequest) {
    return { status: 200, body: await this.service.receivables(req.user as any) }
  }
  async payables(req: HttpRequest) {
    return { status: 200, body: await this.service.payables(req.user as any) }
  }

  async indexSuppliers(req: HttpRequest) {
    const items = await this.service.listSuppliers(req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }
  async storeSupplier(req: HttpRequest) {
    const data = validateSchema(CreateSupplierSchema, req.body)
    const item = await this.service.createSupplier(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateSupplier(req: HttpRequest) {
    const data = validateSchema(UpdateSupplierSchema, req.body)
    const item = await this.service.updateSupplier(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroySupplier(req: HttpRequest) {
    await this.service.deleteSupplier(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Cuentas bancarias + conciliación (TES-1) ───
  async indexBankAccounts(req: HttpRequest) {
    const items = await this.service.listBankAccounts(req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }
  async storeBankAccount(req: HttpRequest) {
    const data = validateSchema(CreateBankAccountSchema, req.body)
    return { status: 201, body: await this.service.createBankAccount(data, req.user as any) }
  }
  async updateBankAccount(req: HttpRequest) {
    const data = validateSchema(UpdateBankAccountSchema, req.body)
    return { status: 200, body: await this.service.updateBankAccount(req.params.id, data, req.user as any) }
  }
  async importMovements(req: HttpRequest) {
    // `rows` (array) se pasa del body crudo; validateSchema no valida arrays.
    const rows = Array.isArray((req.body as any)?.rows) ? (req.body as any).rows : []
    return { status: 200, body: await this.service.importMovements(req.params.id, rows, req.user as any) }
  }
  async reconcile(req: HttpRequest) {
    const bankAccountId = (req.body as any)?.bankAccountId || (req.query as any)?.bankAccountId
    return { status: 200, body: await this.service.reconcile(bankAccountId, req.user as any) }
  }

  // ─── Presupuesto (TES-5) ───
  async indexBudgets(req: HttpRequest) {
    const items = await this.service.listBudgets((req.query as any)?.period, req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }
  async storeBudget(req: HttpRequest) {
    const data = validateSchema(CreateBudgetSchema, req.body)
    return { status: 201, body: await this.service.createBudget(data, req.user as any) }
  }
  async updateBudget(req: HttpRequest) {
    const data = validateSchema(UpdateBudgetSchema, req.body)
    return { status: 200, body: await this.service.updateBudget(req.params.id, data, req.user as any) }
  }
  async budgetVsActual(req: HttpRequest) {
    const period = (req.query as any)?.period as string
    return { status: 200, body: await this.service.budgetVsActual(period, req.user as any) }
  }
}
