// payroll/controller.ts — Adaptador HTTP

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PayrollService } from './service'
import type { CreatePayrollConceptDTO, CreatePayrollRunDTO, PayrollPaymentMethod } from './types'
import { CreateConceptSchema, CreateRunSchema, UpdateConfigSchema, MarkAsPaidSchema } from './validators/schema'
import { parseEmployeeInputs } from './usecases/validate-employees'

/**
 * `hotelId` es obligatorio en el schema pero el cliente no lo manda en el body: sale del token (o del
 * query param). Se inyectaba DESPUÉS de `validateSchema`, así que crear una liquidación o un concepto
 * desde el frontend devolvía 400 `hotelId is required`. Va antes de validar. El token pisa al body.
 */
const withHotelId = (req: HttpRequest): Record<string, unknown> => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const fromReq = (req as any).user?.hotelId ?? (req.query as any)?.hotelId
  return { ...body, hotelId: fromReq ?? body.hotelId }
}

export class PayrollController {
  constructor(private readonly service: PayrollService, private readonly logger: Logger) {}

  // Config
  async getConfig(req: HttpRequest) {
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const config = await this.service.getConfig(hotelId)
    return { status: 200, body: config }
  }

  async updateConfig(req: HttpRequest) {
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const data = validateSchema(UpdateConfigSchema, req.body)
    const config = await this.service.updateConfig(hotelId, data)
    return { status: 200, body: config }
  }

  // Concepts
  async listConcepts(req: HttpRequest) {
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    return { status: 200, body: await this.service.listConcepts(hotelId) }
  }

  async createConcept(req: HttpRequest) {
    const data = validateSchema(CreateConceptSchema, withHotelId(req)) as unknown as CreatePayrollConceptDTO
    return { status: 201, body: await this.service.createConcept(data) }
  }

  async getConcept(req: HttpRequest) {
    const user = (req as any).user
    return { status: 200, body: await this.service.getConcept(req.params.id, user) }
  }

  async deleteConcept(req: HttpRequest) {
    const user = (req as any).user
    await this.service.deleteConcept(req.params.id, user)
    return { status: 204, body: null }
  }

  // Runs
  async listRuns(req: HttpRequest) {
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    return { status: 200, body: await this.service.listRuns(hotelId) }
  }

  async createRun(req: HttpRequest) {
    const data = validateSchema(CreateRunSchema, withHotelId(req)) as unknown as CreatePayrollRunDTO
    return { status: 201, body: await this.service.createRun(data) }
  }

  async getRun(req: HttpRequest) {
    const user = (req as any).user
    return { status: 200, body: await this.service.getRun(req.params.id, user) }
  }

  async getRunDetails(req: HttpRequest) {
    const user = (req as any).user
    return { status: 200, body: await this.service.getRunDetails(req.params.id, user) }
  }

  async prefill(req: HttpRequest) {
    const user = (req as any).user
    return { status: 200, body: await this.service.getPrefill(req.params.id, user) }
  }

  async calculate(req: HttpRequest) {
    const employees = parseEmployeeInputs((req.body as { employees?: unknown } ?? {}).employees)
    const user = (req as any).user
    const result = await this.service.calculateRun(req.params.id, employees, user)
    return { status: 200, body: result }
  }

  async approve(req: HttpRequest) {
    const user = (req as any).user
    const userId = user?.id ?? ''
    return { status: 200, body: await this.service.approveRun(req.params.id, userId, user) }
  }

  async markAsPaid(req: HttpRequest) {
    const user = (req as any).user
    const { paymentMethod } = validateSchema(MarkAsPaidSchema, req.body ?? {}) as { paymentMethod?: PayrollPaymentMethod }
    return { status: 200, body: await this.service.markRunAsPaid(req.params.id, user, paymentMethod) }
  }

  async cancelRun(req: HttpRequest) {
    const user = (req as any).user
    return { status: 200, body: await this.service.cancelRun(req.params.id, user) }
  }
}
