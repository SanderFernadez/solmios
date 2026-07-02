// cash/controller.ts — Adaptador HTTP del módulo Caja.
// Traduce request → service → response. SIN lógica de negocio, SIN ORM directo.
// Toda mutación POST/PUT pasa por validateSchema().

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { CashService } from './service'
import { CreateMovementSchema, UpdateMovementSchema, OpenShiftSchema, CloseShiftSchema } from './validators/schema'

export class CashController {
  constructor(
    private readonly service: CashService,
    private readonly logger: Logger,
  ) {}

  // ─── Movimientos ───
  async index(req: HttpRequest) {
    const result = await this.service.list(req.query as any, req.user as any)
    return { status: 200, body: result }
  }
  async show(req: HttpRequest) {
    const item = await this.service.getById(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async store(req: HttpRequest) {
    const data = validateSchema(CreateMovementSchema, req.body)
    const item = await this.service.create(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async update(req: HttpRequest) {
    const data = validateSchema(UpdateMovementSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Turnos ───
  async listShifts(req: HttpRequest) {
    const items = await this.service.listShifts((req.query as any).hotelId, req.user as any)
    return { status: 200, body: { data: items } }
  }
  async currentShift(req: HttpRequest) {
    const shift = await this.service.getCurrentShift(req.user as any)
    return { status: 200, body: shift }
  }
  async openShift(req: HttpRequest) {
    const data = validateSchema(OpenShiftSchema, req.body)
    const shift = await this.service.openShift(data as any, req.user as any)
    return { status: 201, body: shift }
  }
  async closeShift(req: HttpRequest) {
    const data = validateSchema(CloseShiftSchema, req.body)
    const shift = await this.service.closeShift(req.params.id, data as any, req.user as any)
    return { status: 200, body: shift }
  }
  async reconcile(req: HttpRequest) {
    const result = await this.service.reconcile(req.params.id, req.user as any)
    return { status: 200, body: result }
  }

  // ─── Stats ───
  async stats(req: HttpRequest) {
    const result = await this.service.stats((req.query as any).hotelId, req.user as any)
    return { status: 200, body: result }
  }
}
