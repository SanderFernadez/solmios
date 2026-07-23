// accounting/controller.ts — Adaptador HTTP. Traduce request → service → response.
// SIN lógica de negocio, SIN ORM directo. Toda mutación pasa por validateSchema().
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { AccountingService } from './service'
import { CreateAccountSchema, UpdateAccountSchema } from './validators/schema'

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
}
