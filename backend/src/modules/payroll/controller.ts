// payroll/controller.ts — Adaptador HTTP

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, ValidationError } from 'arckode-framework'
import type { PayrollService } from './service'
import type { CreatePayrollConceptDTO, CreatePayrollRunDTO, PayrollEmployeeInput, PayrollPaymentMethod } from './types'
import { CreateConceptSchema, CreateRunSchema, CalculateSchema, UpdateConfigSchema, MarkAsPaidSchema } from './validators/schema'

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
    const data = validateSchema(CreateConceptSchema, req.body) as unknown as CreatePayrollConceptDTO
    data.hotelId = (req as any).user?.hotelId ?? data.hotelId
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
    const data = validateSchema(CreateRunSchema, req.body) as unknown as CreatePayrollRunDTO
    data.hotelId = (req as any).user?.hotelId ?? data.hotelId
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

  async calculate(req: HttpRequest) {
    validateSchema(CalculateSchema, req.body ?? {})
    const { employees } = (req.body ?? {}) as { employees?: unknown }
    if (!Array.isArray(employees) || employees.length === 0) {
      throw new ValidationError('employees debe ser un array con al menos un empleado')
    }
    const user = (req as any).user
    const result = await this.service.calculateRun(req.params.id, employees as PayrollEmployeeInput[], user)
    return { status: 200, body: result }
  }

  async approve(req: HttpRequest) {
    const userId = (req as any).userId ?? ''
    const user = (req as any).user
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
