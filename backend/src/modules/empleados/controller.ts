// empleados/controller.ts — Adaptador HTTP del módulo

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { EmpleadosService } from './service'
import type {
  CreateDepartmentDTO, CreateEmployeeProfileDTO,
  CreateContractDTO, CreateDocumentDTO,
  CreateLeaveRequestDTO, CreatePerformanceReviewDTO,
} from './types'
import {
  CreateDepartmentSchema, CreateProfileSchema,
  CreateContractSchema, CreateDocumentSchema,
  CreateLeaveRequestSchema, CreateReviewSchema,
} from './validators/schema'

export class EmpleadosController {
  constructor(
    private readonly service: EmpleadosService,
    private readonly logger: Logger,
  ) {}

  // ─── Departments ──────────────────────────────────────

  async createDepartment(req: HttpRequest) {
    this.logger.info('POST /api/departments')
    const data = validateSchema(CreateDepartmentSchema, req.body) as unknown as CreateDepartmentDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    const dept = await this.service.createDepartment(data)
    return { status: 201, body: dept }
  }

  async getDepartment(req: HttpRequest) {
    this.logger.info('GET /api/departments/:id')
    const dept = await this.service.getDepartment(req.params.id)
    return { status: 200, body: dept }
  }

  async listDepartments(req: HttpRequest) {
    this.logger.info('GET /api/departments')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const depts = await this.service.listDepartments(hotelId)
    return { status: 200, body: depts }
  }

  async updateDepartment(req: HttpRequest) {
    this.logger.info('PUT /api/departments/:id')
    const data = req.body as Partial<CreateDepartmentDTO>
    const dept = await this.service.updateDepartment(req.params.id, data)
    return { status: 200, body: dept }
  }

  async deleteDepartment(req: HttpRequest) {
    this.logger.info('DELETE /api/departments/:id')
    await this.service.deleteDepartment(req.params.id)
    return { status: 204, body: null }
  }

  // ─── Employee Profiles ────────────────────────────────

  async createProfile(req: HttpRequest) {
    this.logger.info('POST /api/employee-profiles')
    const data = validateSchema(CreateProfileSchema, req.body) as unknown as CreateEmployeeProfileDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    const profile = await this.service.createProfile(data)
    return { status: 201, body: profile }
  }

  async getProfile(req: HttpRequest) {
    this.logger.info('GET /api/employee-profiles/:id')
    const profile = await this.service.getProfile(req.params.id)
    return { status: 200, body: profile }
  }

  async listProfiles(req: HttpRequest) {
    this.logger.info('GET /api/employee-profiles')
    const query = req.query as any
    query.hotelId = (req as any).hotelId ?? query.hotelId
    const result = await this.service.listProfiles(query)
    return { status: 200, body: result }
  }

  async updateProfile(req: HttpRequest) {
    this.logger.info('PUT /api/employee-profiles/:id')
    const data = req.body as Partial<CreateEmployeeProfileDTO>
    const profile = await this.service.updateProfile(req.params.id, data)
    return { status: 200, body: profile }
  }

  async deactivateProfile(req: HttpRequest) {
    this.logger.info('DELETE /api/employee-profiles/:id')
    await this.service.deactivateProfile(req.params.id)
    return { status: 204, body: null }
  }

  // ─── Contracts ────────────────────────────────────────

  async createContract(req: HttpRequest) {
    this.logger.info('POST /api/employee-contracts')
    const data = validateSchema(CreateContractSchema, req.body) as unknown as CreateContractDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    const contract = await this.service.createContract(data)
    return { status: 201, body: contract }
  }

  async getContract(req: HttpRequest) {
    this.logger.info('GET /api/employee-contracts/:id')
    const contract = await this.service.getContract(req.params.id)
    return { status: 200, body: contract }
  }

  async listContracts(req: HttpRequest) {
    this.logger.info('GET /api/employee-contracts')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const contracts = await this.service.listContracts(hotelId, employeeId)
    return { status: 200, body: contracts }
  }

  async terminateContract(req: HttpRequest) {
    this.logger.info('POST /api/employee-contracts/:id/terminate')
    const contract = await this.service.terminateContract(req.params.id)
    return { status: 200, body: contract }
  }

  // ─── Documents ────────────────────────────────────────

  async createDocument(req: HttpRequest) {
    this.logger.info('POST /api/employee-documents')
    const data = validateSchema(CreateDocumentSchema, req.body) as unknown as CreateDocumentDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    const doc = await this.service.createDocument(data)
    return { status: 201, body: doc }
  }

  async getDocument(req: HttpRequest) {
    this.logger.info('GET /api/employee-documents/:id')
    const doc = await this.service.getDocument(req.params.id)
    return { status: 200, body: doc }
  }

  async listDocuments(req: HttpRequest) {
    this.logger.info('GET /api/employee-documents')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const docs = await this.service.listDocuments(hotelId, employeeId)
    return { status: 200, body: docs }
  }

  async deleteDocument(req: HttpRequest) {
    this.logger.info('DELETE /api/employee-documents/:id')
    await this.service.deleteDocument(req.params.id)
    return { status: 204, body: null }
  }

  // ─── Leave Requests ───────────────────────────────────

  async createLeaveRequest(req: HttpRequest) {
    this.logger.info('POST /api/leave-requests')
    const data = validateSchema(CreateLeaveRequestSchema, req.body) as unknown as CreateLeaveRequestDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    const request = await this.service.createLeaveRequest(data)
    return { status: 201, body: request }
  }

  async getLeaveRequest(req: HttpRequest) {
    this.logger.info('GET /api/leave-requests/:id')
    const request = await this.service.getLeaveRequest(req.params.id)
    return { status: 200, body: request }
  }

  async listLeaveRequests(req: HttpRequest) {
    this.logger.info('GET /api/leave-requests')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const status = (req.query as any).status
    const requests = await this.service.listLeaveRequests(hotelId, employeeId, status)
    return { status: 200, body: requests }
  }

  async approveLeaveRequest(req: HttpRequest) {
    this.logger.info('POST /api/leave-requests/:id/approve')
    const userId = (req as any).userId ?? ''
    const request = await this.service.approveLeaveRequest(req.params.id, userId)
    return { status: 200, body: request }
  }

  async rejectLeaveRequest(req: HttpRequest) {
    this.logger.info('POST /api/leave-requests/:id/reject')
    const userId = (req as any).userId ?? ''
    const { reason } = req.body as { reason?: string }
    const request = await this.service.rejectLeaveRequest(req.params.id, userId, reason)
    return { status: 200, body: request }
  }

  // ─── Performance Reviews ──────────────────────────────

  async createReview(req: HttpRequest) {
    this.logger.info('POST /api/performance-reviews')
    const data = validateSchema(CreateReviewSchema, req.body) as unknown as CreatePerformanceReviewDTO
    data.hotelId = (req as any).hotelId ?? data.hotelId
    const review = await this.service.createReview(data)
    return { status: 201, body: review }
  }

  async getReview(req: HttpRequest) {
    this.logger.info('GET /api/performance-reviews/:id')
    const review = await this.service.getReview(req.params.id)
    return { status: 200, body: review }
  }

  async listReviews(req: HttpRequest) {
    this.logger.info('GET /api/performance-reviews')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const reviews = await this.service.listReviews(hotelId, employeeId)
    return { status: 200, body: reviews }
  }

  async completeReview(req: HttpRequest) {
    this.logger.info('POST /api/performance-reviews/:id/complete')
    const review = await this.service.completeReview(req.params.id)
    return { status: 200, body: review }
  }

  // ─── Alerts & Org Chart ───────────────────────────────

  async getExpiringDocuments(req: HttpRequest) {
    this.logger.info('GET /api/employee-documents/expiring')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const days = parseInt((req.query as any).days ?? '30')
    const alerts = await this.service.getExpiringDocuments(hotelId, days)
    return { status: 200, body: alerts }
  }

  async getOrgChart(req: HttpRequest) {
    this.logger.info('GET /api/org-chart')
    const hotelId = (req as any).hotelId ?? (req.query as any).hotelId
    const chart = await this.service.getOrgChart(hotelId)
    return { status: 200, body: chart }
  }
}
