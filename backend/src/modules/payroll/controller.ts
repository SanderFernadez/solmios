// payroll/controller.ts — Adaptador HTTP

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PayrollService } from './service'
import type { CreatePayrollConceptDTO, CreatePayrollRunDTO, PayrollEmployeeInput } from './types'
import { CreateConceptSchema, CreateRunSchema, CalculateSchema } from './validators/schema'

export class PayrollController {
  constructor(private readonly service: PayrollService, private readonly logger: Logger) {}

  // Config
  async getConfig(req: HttpRequest) {
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const config = await this.service.getConfig(hotelId)
    return { status: 200, body: config }
  }

  async updateConfig(req: HttpRequest) {
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const config = await this.service.updateConfig(hotelId, req.body as any)
    return { status: 200, body: config }
  }

  // Concepts
  async listConcepts(req: HttpRequest) {
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    return { status: 200, body: await this.service.listConcepts(hotelId) }
  }

  async createConcept(req: HttpRequest) {
    const data = validateSchema(CreateConceptSchema, req.body) as unknown as CreatePayrollConceptDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    return { status: 201, body: await this.service.createConcept(data) }
  }

  async getConcept(req: HttpRequest) {
    return { status: 200, body: await this.service.getConcept(req.params.id) }
  }

  async deleteConcept(req: HttpRequest) {
    await this.service.deleteConcept(req.params.id)
    return { status: 204, body: null }
  }

  // Runs
  async listRuns(req: HttpRequest) {
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    return { status: 200, body: await this.service.listRuns(hotelId) }
  }

  async createRun(req: HttpRequest) {
    const data = validateSchema(CreateRunSchema, req.body) as unknown as CreatePayrollRunDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    return { status: 201, body: await this.service.createRun(data) }
  }

  async getRun(req: HttpRequest) {
    return { status: 200, body: await this.service.getRun(req.params.id) }
  }

  async getRunDetails(req: HttpRequest) {
    return { status: 200, body: await this.service.getRunDetails(req.params.id) }
  }

  async calculate(req: HttpRequest) {
    const data = validateSchema(CalculateSchema, req.body) as any
    const employees = data.employees as PayrollEmployeeInput[]
    const result = await this.service.calculateRun(req.params.id, employees)
    return { status: 200, body: result }
  }

  async approve(req: HttpRequest) {
    const userId = (req as any).userId ?? ''
    return { status: 200, body: await this.service.approveRun(req.params.id, userId) }
  }

  async markAsPaid(req: HttpRequest) {
    return { status: 200, body: await this.service.markRunAsPaid(req.params.id) }
  }

  async cancelRun(req: HttpRequest) {
    return { status: 200, body: await this.service.cancelRun(req.params.id) }
  }
}
