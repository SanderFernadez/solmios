// empleados/controller.ts — Adaptador HTTP del módulo

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, NotFoundError } from 'arckode-framework'
import type { EmpleadosService } from './service'
import type { DashboardUseCase } from './usecases/dashboard'
import type { StorageService } from 'arckode-framework/modules/storage'
import { parseDataUrl } from '../../shared/utils/data-url'
import type {
  CreateDepartmentDTO, CreateEmployeeProfileDTO,
  CreateContractDTO, CreateDocumentDTO,
  CreateLeaveRequestDTO, CreatePerformanceReviewDTO,
} from './types'
import {
  CreateDepartmentSchema, CreateProfileSchema,
  CreateContractSchema, CreateDocumentSchema,
  CreateLeaveRequestSchema, CreateReviewSchema,
  UpdateDepartmentSchema, UpdateProfileSchema, RejectLeaveRequestSchema,
} from './validators/schema'

/**
 * `hotelId` es obligatorio en cada schema pero el cliente no lo manda: sale del token (o del query).
 * Se inyectaba DESPUÉS de `validateSchema`, así que crear un contrato/documento/ausencia/evaluación
 * desde el frontend devolvía 400 `hotelId is required`. Va antes de validar; el token pisa al body.
 */
const withHotelId = (req: HttpRequest): Record<string, unknown> => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const fromReq = (req as any).user?.hotelId ?? (req.query as any)?.hotelId
  return { ...body, hotelId: fromReq ?? body.hotelId }
}

export class EmpleadosController {
  constructor(
    private readonly service: EmpleadosService,
    private readonly logger: Logger,
    // Agregación de solo-lectura: va directo al usecase para no engordar el service (gate 200 líneas).
    private readonly dashboard?: DashboardUseCase,
    // Para subir el archivo del documento (base64 → storage), en vez de pegar una URL.
    private readonly storage?: StorageService,
  ) {}

  // ─── Departments ──────────────────────────────────────

  async createDepartment(req: HttpRequest) {
    this.logger.info('POST /api/departments')
    const data = validateSchema(CreateDepartmentSchema, withHotelId(req)) as unknown as CreateDepartmentDTO
    const dept = await this.service.createDepartment(data)
    return { status: 201, body: dept }
  }

  async getDepartment(req: HttpRequest) {
    this.logger.info('GET /api/departments/:id')
    const dept = await this.service.getDepartment(req.params.id, (req as any).user)
    return { status: 200, body: dept }
  }

  async listDepartments(req: HttpRequest) {
    this.logger.info('GET /api/departments')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const depts = await this.service.listDepartments(hotelId)
    return { status: 200, body: depts }
  }

  async updateDepartment(req: HttpRequest) {
    this.logger.info('PUT /api/departments/:id')
    const data = validateSchema(UpdateDepartmentSchema, req.body)
    const dept = await this.service.updateDepartment(req.params.id, data, (req as any).user)
    return { status: 200, body: dept }
  }

  async deleteDepartment(req: HttpRequest) {
    this.logger.info('DELETE /api/departments/:id')
    await this.service.deleteDepartment(req.params.id, (req as any).user)
    return { status: 204, body: null }
  }

  // ─── Employee Profiles ────────────────────────────────

  async createProfile(req: HttpRequest) {
    this.logger.info('POST /api/employee-profiles')
    const data = validateSchema(CreateProfileSchema, withHotelId(req)) as unknown as CreateEmployeeProfileDTO
    const profile = await this.service.createProfile(data)
    return { status: 201, body: profile }
  }

  async getProfile(req: HttpRequest) {
    this.logger.info('GET /api/employee-profiles/:id')
    const profile = await this.service.getProfile(req.params.id, (req as any).user)
    return { status: 200, body: profile }
  }

  /** GET /api/employee-profiles/me — el perfil del que llama. Sin `users:view`. */
  async myProfile(req: HttpRequest) {
    const user = (req as any).user
    const profile = await this.service.myProfile(user?.id, user?.hotelId)
    if (!profile) throw new NotFoundError('Este usuario no tiene un perfil de empleado')
    return { status: 200, body: profile }
  }

  async listProfiles(req: HttpRequest) {
    this.logger.info('GET /api/employee-profiles')
    const query = req.query as any
    const user = (req as any).user
    // hotelId viene del JWT (HotelAuth) o del query param como fallback
    query.hotelId = user?.hotelId || query.hotelId
    if (user?.role !== 'super_admin' && !query.hotelId) {
      return { status: 400, body: { error: 'hotelId requerido' } }
    }
    const result = await this.service.listProfiles(query, user)
    return { status: 200, body: result }
  }

  async updateProfile(req: HttpRequest) {
    this.logger.info('PUT /api/employee-profiles/:id')
    const data = validateSchema(UpdateProfileSchema, req.body)
    const profile = await this.service.updateProfile(req.params.id, data, (req as any).user)
    return { status: 200, body: profile }
  }

  async deactivateProfile(req: HttpRequest) {
    this.logger.info('DELETE /api/employee-profiles/:id')
    await this.service.deactivateProfile(req.params.id, (req as any).user)
    return { status: 204, body: null }
  }

  // ─── Contracts ────────────────────────────────────────

  async createContract(req: HttpRequest) {
    this.logger.info('POST /api/employee-contracts')
    const data = validateSchema(CreateContractSchema, withHotelId(req)) as unknown as CreateContractDTO
    const contract = await this.service.createContract(data)
    return { status: 201, body: contract }
  }

  async getContract(req: HttpRequest) {
    this.logger.info('GET /api/employee-contracts/:id')
    const contract = await this.service.getContract(req.params.id, (req as any).user)
    return { status: 200, body: contract }
  }

  async listContracts(req: HttpRequest) {
    this.logger.info('GET /api/employee-contracts')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const contracts = await this.service.listContracts(hotelId, employeeId)
    return { status: 200, body: contracts }
  }

  async terminateContract(req: HttpRequest) {
    this.logger.info('POST /api/employee-contracts/:id/terminate')
    const contract = await this.service.terminateContract(req.params.id, (req as any).user)
    return { status: 200, body: contract }
  }

  // ─── Documents ────────────────────────────────────────

  async createDocument(req: HttpRequest) {
    this.logger.info('POST /api/employee-documents')
    const raw = (req.body ?? {}) as any
    // El archivo llega como data URL base64 (`fileData`); se guarda en storage y su URL va a `fileUrl`.
    // Se mantiene soporte de `fileUrl` directo por compatibilidad.
    let fileUrl = raw.fileUrl
    if (raw.fileData) {
      if (!this.storage) return { status: 500, body: { error: 'Almacenamiento no configurado' } }
      const parsed = parseDataUrl(raw.fileData)
      if (!parsed) return { status: 400, body: { error: 'Archivo inválido' } }
      const stored = await this.storage.upload({
        fieldName: 'file', originalName: raw.fileName || `documento.${parsed.ext}`,
        buffer: parsed.buffer, mimeType: parsed.mimeType, size: parsed.buffer.length,
      }, 'employee-documents')
      fileUrl = stored.url
    }
    const fromReq = (req as any).user?.hotelId ?? (req.query as any)?.hotelId
    const data = validateSchema(CreateDocumentSchema, { ...raw, hotelId: fromReq ?? raw.hotelId, fileUrl, fileData: undefined }) as unknown as CreateDocumentDTO
    const doc = await this.service.createDocument(data)
    return { status: 201, body: doc }
  }

  async getDocument(req: HttpRequest) {
    this.logger.info('GET /api/employee-documents/:id')
    const doc = await this.service.getDocument(req.params.id, (req as any).user)
    return { status: 200, body: doc }
  }

  async listDocuments(req: HttpRequest) {
    this.logger.info('GET /api/employee-documents')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const docs = await this.service.listDocuments(hotelId, employeeId)
    return { status: 200, body: docs }
  }

  async deleteDocument(req: HttpRequest) {
    this.logger.info('DELETE /api/employee-documents/:id')
    await this.service.deleteDocument(req.params.id, (req as any).user)
    return { status: 204, body: null }
  }

  // ─── Leave Requests ───────────────────────────────────

  async createLeaveRequest(req: HttpRequest) {
    this.logger.info('POST /api/leave-requests')
    const data = validateSchema(CreateLeaveRequestSchema, withHotelId(req)) as unknown as CreateLeaveRequestDTO
    const request = await this.service.createLeaveRequest(data)
    return { status: 201, body: request }
  }

  async getLeaveRequest(req: HttpRequest) {
    this.logger.info('GET /api/leave-requests/:id')
    const request = await this.service.getLeaveRequest(req.params.id, (req as any).user)
    return { status: 200, body: request }
  }

  async listLeaveRequests(req: HttpRequest) {
    this.logger.info('GET /api/leave-requests')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const status = (req.query as any).status
    const requests = await this.service.listLeaveRequests(hotelId, employeeId, status)
    return { status: 200, body: requests }
  }

  async approveLeaveRequest(req: HttpRequest) {
    this.logger.info('POST /api/leave-requests/:id/approve')
    const userId = (req as any).userId ?? (req as any).user?.id ?? ''
    const request = await this.service.approveLeaveRequest(req.params.id, userId, (req as any).user)
    return { status: 200, body: request }
  }

  async rejectLeaveRequest(req: HttpRequest) {
    this.logger.info('POST /api/leave-requests/:id/reject')
    const userId = (req as any).userId ?? (req as any).user?.id ?? ''
    const data = validateSchema(RejectLeaveRequestSchema, req.body) as any
    const request = await this.service.rejectLeaveRequest(req.params.id, userId, data.reason, (req as any).user)
    return { status: 200, body: request }
  }

  // ─── Performance Reviews ──────────────────────────────

  async createReview(req: HttpRequest) {
    this.logger.info('POST /api/performance-reviews')
    const data = validateSchema(CreateReviewSchema, withHotelId(req)) as unknown as CreatePerformanceReviewDTO
    const review = await this.service.createReview(data)
    return { status: 201, body: review }
  }

  async getReview(req: HttpRequest) {
    this.logger.info('GET /api/performance-reviews/:id')
    const review = await this.service.getReview(req.params.id, (req as any).user)
    return { status: 200, body: review }
  }

  async listReviews(req: HttpRequest) {
    this.logger.info('GET /api/performance-reviews')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const employeeId = (req.query as any).employeeId
    const reviews = await this.service.listReviews(hotelId, employeeId)
    return { status: 200, body: reviews }
  }

  async completeReview(req: HttpRequest) {
    this.logger.info('POST /api/performance-reviews/:id/complete')
    const review = await this.service.completeReview(req.params.id, (req as any).user)
    return { status: 200, body: review }
  }

  // ─── Alerts & Org Chart ───────────────────────────────

  async getExpiringDocuments(req: HttpRequest) {
    this.logger.info('GET /api/employee-documents/expiring')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const days = parseInt((req.query as any).days ?? '30')
    const alerts = await this.service.getExpiringDocuments(hotelId, days)
    return { status: 200, body: alerts }
  }

  async getOrgChart(req: HttpRequest) {
    this.logger.info('GET /api/org-chart')
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    const chart = await this.service.getOrgChart(hotelId)
    return { status: 200, body: chart }
  }

  async getDashboard(req: HttpRequest) {
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    if (!this.dashboard) return { status: 500, body: { error: 'Dashboard no configurado' } }
    return { status: 200, body: await this.dashboard.get(hotelId) }
  }
}
