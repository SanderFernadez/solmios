// accounting/controller.ts — Adaptador HTTP. Traduce request → service → response.
// SIN lógica de negocio, SIN ORM directo. Toda mutación pasa por validateSchema().
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { AccountingService } from './service'
import { CreateAccountSchema, UpdateAccountSchema, CreateJournalEntrySchema } from './validators/schema'

export class AccountingController {
  constructor(
    private readonly service: AccountingService,
    private readonly logger: Logger,
  ) {}

  async indexAccounts(req: HttpRequest) {
    this.logger.info('GET /accounting/accounts')
    const result = await this.service.listAccounts(req.query as any, req.user as any)
    return { status: 200, body: result }
  }

  async showAccount(req: HttpRequest) {
    this.logger.info('GET /accounting/accounts/:id', { id: req.params.id })
    const item = await this.service.getAccount(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async storeAccount(req: HttpRequest) {
    this.logger.info('POST /accounting/accounts')
    const data = validateSchema(CreateAccountSchema, req.body)
    const item = await this.service.createAccount(data as any, req.user as any)
    return { status: 201, body: item }
  }

  async updateAccount(req: HttpRequest) {
    this.logger.info('PUT /accounting/accounts/:id', { id: req.params.id })
    const data = validateSchema(UpdateAccountSchema, req.body)
    const item = await this.service.updateAccount(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroyAccount(req: HttpRequest) {
    this.logger.info('DELETE /accounting/accounts/:id', { id: req.params.id })
    await this.service.deleteAccount(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Plan de cuentas base (CTB-1.3) ───
  async seedChart(req: HttpRequest) {
    this.logger.info('POST /accounting/seed')
    const res = await this.service.seedChart(req.user as any)
    return { status: 200, body: res }
  }

  // ─── Asientos (CTB-2) ───
  async indexJournal(req: HttpRequest) {
    this.logger.info('GET /accounting/journal')
    const period = (req.query as any)?.period as string | undefined
    const items = await this.service.listEntries(period, req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }

  async storeJournal(req: HttpRequest) {
    this.logger.info('POST /accounting/journal')
    // Campos escalares por validateSchema; `lines` (array) se pasa del body y lo valida el usecase.
    const scalar = validateSchema(CreateJournalEntrySchema, req.body) as any
    const body = (req.body ?? {}) as any
    const item = await this.service.createEntry(
      { ...scalar, lines: Array.isArray(body.lines) ? body.lines : [] },
      req.user as any,
    )
    return { status: 201, body: item }
  }

  async postJournal(req: HttpRequest) {
    this.logger.info('POST /accounting/journal/:id/post', { id: req.params.id })
    await this.service.postEntry(req.params.id, req.user as any)
    return { status: 200, body: { ok: true } }
  }

  async reverseJournal(req: HttpRequest) {
    this.logger.info('POST /accounting/journal/:id/reverse', { id: req.params.id })
    const res = await this.service.reverseEntry(req.params.id, req.user as any)
    return { status: 200, body: res }
  }

  // ─── Períodos (CTB-3) ───
  async indexPeriods(req: HttpRequest) {
    const items = await this.service.listPeriods(req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }

  async closePeriod(req: HttpRequest) {
    this.logger.info('POST /accounting/periods/:id/close', { id: req.params.id })
    await this.service.closePeriod(req.params.id, req.user as any)
    return { status: 200, body: { ok: true } }
  }

  async lockPeriod(req: HttpRequest) {
    this.logger.info('POST /accounting/periods/:id/lock', { id: req.params.id })
    await this.service.lockPeriod(req.params.id, req.user as any)
    return { status: 200, body: { ok: true } }
  }

  // ─── Reportes (CTB-5/CTB-6) ───
  async trialBalance(req: HttpRequest) {
    const period = (req.query as any)?.period as string | undefined
    return { status: 200, body: await this.service.trialBalance(period, req.user as any) }
  }
  async ledger(req: HttpRequest) {
    const accountId = (req.query as any)?.account as string
    return { status: 200, body: await this.service.generalLedger(accountId, req.user as any) }
  }
  async pnl(req: HttpRequest) {
    const q = req.query as any
    return { status: 200, body: await this.service.profitLoss(q?.from, q?.to, req.user as any) }
  }
  async balanceSheet(req: HttpRequest) {
    const period = (req.query as any)?.period as string | undefined
    return { status: 200, body: await this.service.balanceSheet(period, req.user as any) }
  }
}
