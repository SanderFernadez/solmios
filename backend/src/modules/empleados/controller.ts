// empleados/controller.ts — Adaptador HTTP del módulo

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, NotFoundError } from 'arckode-framework'
import type { EmpleadosService } from './service'
import type { DashboardUseCase } from './usecases/dashboard'
import type { LeaveConfigUseCase } from './usecases/leave-config'
import type { AppraisalConfigUseCase } from './usecases/appraisal-config'
import type { HrCatalogUseCase } from './usecases/hr-catalog'
import type { EvalConfigUseCase } from './usecases/eval-config'
import type { AutoEvaluationUseCase } from './usecases/auto-evaluation'
import type { EvalPeriodType, UpdatePerformanceEvalConfigDTO } from './types'
import type { StorageService } from 'arckode-framework/modules/storage'
import { parseDataUrl } from '../../shared/utils/data-url'
import type {
  CreateDepartmentDTO, CreateEmployeeProfileDTO,
  CreateContractDTO, CreateDocumentDTO,
  CreateLeaveRequestDTO, CreatePerformanceReviewDTO, UpdatePerformanceReviewDTO,
  CreateLeaveTypeDTO, CreateLeaveAllocationDTO, CreatePublicHolidayDTO,
  CreateJobPositionDTO, CreateContractTypeDTO, CreateWorkLocationDTO,
} from './types'
import {
  CreateDepartmentSchema, CreateProfileSchema,
  CreateContractSchema, CreateDocumentSchema,
  CreateLeaveRequestSchema, CreateReviewSchema,
  UpdateDepartmentSchema, UpdateProfileSchema, RejectLeaveRequestSchema,
  CreateLeaveTypeSchema, UpdateLeaveTypeSchema, CreateLeaveAllocationSchema, CreatePublicHolidaySchema,
  UpdateReviewSchema, CreateAppraisalTemplateSchema,
  CreateJobPositionSchema, CreateContractTypeSchema, CreateWorkLocationSchema,
  UpdateEvalConfigSchema,
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
    // Time Off (tipos/asignaciones/festivos/saldo): usecase directo, mismo criterio que dashboard.
    private readonly leaveConfig?: LeaveConfigUseCase,
    // Plantillas de evaluación: idem.
    private readonly appraisalConfig?: AppraisalConfigUseCase,
    // Catálogos RRHH (puestos, tipos de contrato, ubicaciones): idem.
    private readonly hrCatalog?: HrCatalogUseCase,
    // Config del motor de evaluación (#322) y el motor automático (#321): usecases directos.
    private readonly evalConfig?: EvalConfigUseCase,
    private readonly autoEval?: AutoEvaluationUseCase,
  ) {}

  private evalCfg(): EvalConfigUseCase {
    if (!this.evalConfig) throw new NotFoundError('Evaluación automática no configurada')
    return this.evalConfig
  }

  private engine(): AutoEvaluationUseCase {
    if (!this.autoEval) throw new NotFoundError('Motor de evaluación no configurado')
    return this.autoEval
  }

  private catalog(): HrCatalogUseCase {
    if (!this.hrCatalog) throw new NotFoundError('Catálogos RRHH no configurados')
    return this.hrCatalog
  }

  private cfg(): LeaveConfigUseCase {
    if (!this.leaveConfig) throw new NotFoundError('Time Off no configurado')
    return this.leaveConfig
  }

  private appraisal(): AppraisalConfigUseCase {
    if (!this.appraisalConfig) throw new NotFoundError('Evaluaciones no configuradas')
    return this.appraisalConfig
  }

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
    // El query param llega como string ('true'/'1') → normalizar a booleano.
    query.includeInactive = query.includeInactive === 'true' || query.includeInactive === '1'
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

  async reactivateProfile(req: HttpRequest) {
    this.logger.info('POST /api/employee-profiles/:id/reactivate')
    const profile = await this.service.reactivateProfile(req.params.id, (req as any).user)
    return { status: 200, body: profile }
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

  // ─── Time Off: tipos, asignaciones, festivos, saldo, calendario ──

  private hotelOf(req: HttpRequest): string {
    return (req as any).user?.hotelId ?? (req.query as any)?.hotelId ?? ''
  }

  async listLeaveTypes(req: HttpRequest) {
    return { status: 200, body: await this.cfg().listTypes(this.hotelOf(req)) }
  }

  async createLeaveType(req: HttpRequest) {
    this.logger.info('POST /api/leave-types')
    const data = validateSchema(CreateLeaveTypeSchema, withHotelId(req)) as unknown as CreateLeaveTypeDTO
    return { status: 201, body: await this.cfg().createType(data) }
  }

  async updateLeaveType(req: HttpRequest) {
    const data = validateSchema(UpdateLeaveTypeSchema, req.body) as Partial<CreateLeaveTypeDTO>
    return { status: 200, body: await this.cfg().updateType(req.params.id, this.hotelOf(req), data) }
  }

  async deleteLeaveType(req: HttpRequest) {
    await this.cfg().deleteType(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
  }

  async listLeaveAllocations(req: HttpRequest) {
    const q = req.query as any
    const year = q.year ? parseInt(q.year, 10) : undefined
    return { status: 200, body: await this.cfg().listAllocations(this.hotelOf(req), q.employeeId, year) }
  }

  async createLeaveAllocation(req: HttpRequest) {
    this.logger.info('POST /api/leave-allocations')
    const data = validateSchema(CreateLeaveAllocationSchema, withHotelId(req)) as unknown as CreateLeaveAllocationDTO
    return { status: 201, body: await this.cfg().createAllocation(data) }
  }

  async deleteLeaveAllocation(req: HttpRequest) {
    await this.cfg().deleteAllocation(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
  }

  async listPublicHolidays(req: HttpRequest) {
    const q = req.query as any
    const year = q.year ? parseInt(q.year, 10) : undefined
    return { status: 200, body: await this.cfg().listHolidays(this.hotelOf(req), year) }
  }

  async createPublicHoliday(req: HttpRequest) {
    this.logger.info('POST /api/public-holidays')
    const data = validateSchema(CreatePublicHolidaySchema, withHotelId(req)) as unknown as CreatePublicHolidayDTO
    return { status: 201, body: await this.cfg().createHoliday(data) }
  }

  async deletePublicHoliday(req: HttpRequest) {
    await this.cfg().deleteHoliday(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
  }

  async getLeaveBalance(req: HttpRequest) {
    const q = req.query as any
    const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear()
    return { status: 200, body: await this.cfg().getBalance(this.hotelOf(req), req.params.employeeId, year) }
  }

  async getLeaveCalendar(req: HttpRequest) {
    const q = req.query as any
    if (!q.from || !q.to) return { status: 400, body: { error: 'from y to son obligatorios (YYYY-MM-DD)' } }
    return { status: 200, body: await this.cfg().getCalendar(this.hotelOf(req), q.from, q.to) }
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

  async updateReview(req: HttpRequest) {
    this.logger.info('PUT /api/performance-reviews/:id')
    const data = validateSchema(UpdateReviewSchema, req.body) as unknown as UpdatePerformanceReviewDTO
    const review = await this.service.updateReview(req.params.id, data, (req as any).user)
    return { status: 200, body: review }
  }

  async completeReview(req: HttpRequest) {
    this.logger.info('POST /api/performance-reviews/:id/complete')
    const review = await this.service.completeReview(req.params.id, (req as any).user)
    return { status: 200, body: review }
  }

  // ─── Appraisal Templates (formularios de evaluación) ──
  async listAppraisalTemplates(req: HttpRequest) {
    return { status: 200, body: await this.appraisal().list(this.hotelOf(req)) }
  }

  async createAppraisalTemplate(req: HttpRequest) {
    this.logger.info('POST /api/appraisal-templates')
    const base = validateSchema(CreateAppraisalTemplateSchema, withHotelId(req)) as any
    // `questions` (array) va aparte: validateSchema descartaría un campo no declarado (mem 1805).
    const questions = (req.body as any)?.questions
    return { status: 201, body: await this.appraisal().create({ ...base, questions }) }
  }

  async updateAppraisalTemplate(req: HttpRequest) {
    const body = (req.body ?? {}) as any
    return { status: 200, body: await this.appraisal().update(req.params.id, this.hotelOf(req), { name: body.name, questions: body.questions }) }
  }

  async deleteAppraisalTemplate(req: HttpRequest) {
    await this.appraisal().remove(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
  }

  // ─── Performance Eval: config (#322) + motor automático (#321) ──
  async getEvalConfig(req: HttpRequest) {
    return { status: 200, body: await this.evalCfg().get(this.hotelOf(req)) }
  }

  async updateEvalConfig(req: HttpRequest) {
    this.logger.info('PUT /api/performance-eval/config')
    const base = validateSchema(UpdateEvalConfigSchema, req.body) as any
    // weights/thresholds son objetos: van aparte porque validateSchema descarta los campos objeto.
    const body = (req.body ?? {}) as any
    const data = { ...base, weights: body.weights, thresholds: body.thresholds } as UpdatePerformanceEvalConfigDTO
    return { status: 200, body: await this.evalCfg().update(this.hotelOf(req), data) }
  }

  async runAutoEvaluation(req: HttpRequest) {
    this.logger.info('POST /api/performance-eval/run')
    const period = ((req.body as any)?.period ?? (req.query as any)?.period) as EvalPeriodType | undefined
    return { status: 200, body: await this.engine().run(this.hotelOf(req), period) }
  }

  async listEvalResults(req: HttpRequest) {
    const period = (req.query as any)?.period as string | undefined
    return { status: 200, body: await this.engine().listResults(this.hotelOf(req), period) }
  }

  // ─── Catálogos: puestos, tipos de contrato, ubicaciones ──
  async listJobPositions(req: HttpRequest) {
    return { status: 200, body: await this.catalog().listJobs(this.hotelOf(req)) }
  }
  async createJobPosition(req: HttpRequest) {
    const data = validateSchema(CreateJobPositionSchema, withHotelId(req)) as unknown as CreateJobPositionDTO
    return { status: 201, body: await this.catalog().createJob(data) }
  }
  async updateJobPosition(req: HttpRequest) {
    return { status: 200, body: await this.catalog().updateJob(req.params.id, this.hotelOf(req), (req.body ?? {}) as any) }
  }
  async deleteJobPosition(req: HttpRequest) {
    await this.catalog().deleteJob(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
  }

  async listContractTypes(req: HttpRequest) {
    return { status: 200, body: await this.catalog().listContractTypes(this.hotelOf(req)) }
  }
  async createContractType(req: HttpRequest) {
    const data = validateSchema(CreateContractTypeSchema, withHotelId(req)) as unknown as CreateContractTypeDTO
    return { status: 201, body: await this.catalog().createContractType(data) }
  }
  async deleteContractType(req: HttpRequest) {
    await this.catalog().deleteContractType(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
  }

  async listWorkLocations(req: HttpRequest) {
    return { status: 200, body: await this.catalog().listLocations(this.hotelOf(req)) }
  }
  async createWorkLocation(req: HttpRequest) {
    const data = validateSchema(CreateWorkLocationSchema, withHotelId(req)) as unknown as CreateWorkLocationDTO
    return { status: 201, body: await this.catalog().createLocation(data) }
  }
  async deleteWorkLocation(req: HttpRequest) {
    await this.catalog().deleteLocation(req.params.id, this.hotelOf(req))
    return { status: 204, body: null }
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
