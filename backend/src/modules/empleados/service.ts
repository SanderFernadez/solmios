// empleados/service.ts — Facade pública del módulo Empleados
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import type {
  DepartmentDTO, CreateDepartmentDTO,
  EmployeeProfileDTO, CreateEmployeeProfileDTO,
  ContractDTO, CreateContractDTO,
  DocumentDTO, CreateDocumentDTO,
  LeaveRequestDTO, CreateLeaveRequestDTO,
  PerformanceReviewDTO, CreatePerformanceReviewDTO, UpdatePerformanceReviewDTO,
  EmpleadosQuery, EmpleadosPaginated,
  DocumentExpiryAlert,
} from './types'
import type { EmpleadosSockets } from './sockets'
import { accumulateSockets } from '../../shared/utils/accumulate-sockets'
import { DepartmentUseCase } from './usecases/departments'
import { ProfileUseCase } from './usecases/profiles'
import { ContractUseCase } from './usecases/contracts'
import { DocumentUseCase } from './usecases/documents'
import { LeaveRequestUseCase } from './usecases/leave-requests'
import { LeaveConfigUseCase } from './usecases/leave-config'
import { ReviewUseCase } from './usecases/reviews'
import { OrgChartUseCase } from './usecases/org-chart'
import type { DashboardUseCase, AttendanceSummaryPort } from './usecases/dashboard'
import type { SimpleUser } from './usecases/ownership'

export class EmpleadosService {
  private sockets: EmpleadosSockets = {}
  private departments: DepartmentUseCase
  private profiles: ProfileUseCase
  private contracts: ContractUseCase
  private documents: DocumentUseCase
  private leaveRequests: LeaveRequestUseCase
  private reviews: ReviewUseCase
  private orgChart: OrgChartUseCase

  constructor(
    departmentRepo: RepositoryAdapter<DepartmentDTO>,
    profileRepo: RepositoryAdapter<EmployeeProfileDTO>,
    contractRepo: RepositoryAdapter<ContractDTO>,
    documentRepo: RepositoryAdapter<DocumentDTO>,
    leaveRepo: RepositoryAdapter<LeaveRequestDTO>,
    reviewRepo: RepositoryAdapter<PerformanceReviewDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    userRepo?: RepositoryAdapter<any>,
    auth?: Auth,
    leaveConfig?: LeaveConfigUseCase,
  ) {
    this.departments = new DepartmentUseCase(departmentRepo, logger, auth)
    this.profiles = new ProfileUseCase(profileRepo, logger, userRepo, auth)
    this.contracts = new ContractUseCase(contractRepo, profileRepo, logger, auth)
    this.documents = new DocumentUseCase(documentRepo, profileRepo, userRepo, logger, auth)
    this.leaveRequests = new LeaveRequestUseCase(leaveRepo, profileRepo, logger, auth, leaveConfig)
    this.reviews = new ReviewUseCase(reviewRepo, profileRepo, logger, auth)
    this.orgChart = new OrgChartUseCase(departmentRepo, profileRepo, logger, userRepo)
  }

  setSockets(s: Partial<EmpleadosSockets>): void {
    accumulateSockets(this.sockets, s)
  }

  // El dashboard vive en un usecase aparte (gate 200 líneas). El connector attendance-dashboard
  // inyecta el fichaje de hoy vía este puerto (#198).
  private dashboard?: DashboardUseCase
  attachDashboard(d: DashboardUseCase): void { this.dashboard = d }
  setAttendancePort(port: AttendanceSummaryPort): void { this.dashboard?.setAttendancePort(port) }

  // ─── Departments ──────────────────────────────────────

  async createDepartment(dto: CreateDepartmentDTO): Promise<DepartmentDTO> {
    return this.departments.create(dto)
  }

  async getDepartment(id: string, user?: SimpleUser): Promise<DepartmentDTO> {
    return this.departments.getById(id, user)
  }

  async listDepartments(hotelId: string): Promise<DepartmentDTO[]> {
    return this.departments.list(hotelId)
  }

  async updateDepartment(id: string, data: Partial<CreateDepartmentDTO>, user?: SimpleUser): Promise<DepartmentDTO> {
    return this.departments.update(id, data, user)
  }

  async deleteDepartment(id: string, user?: SimpleUser): Promise<void> {
    return this.departments.delete(id, user)
  }

  // ─── Employee Profiles ────────────────────────────────

  async createProfile(dto: CreateEmployeeProfileDTO): Promise<EmployeeProfileDTO> {
    const profile = await this.profiles.create(dto)
    this.sockets.onEmployeeCreated?.(profile)
    return profile
  }

  async getProfile(id: string, user?: SimpleUser): Promise<EmployeeProfileDTO> {
    return this.profiles.getById(id, user)
  }

  async listProfiles(query: EmpleadosQuery, user?: SimpleUser): Promise<EmpleadosPaginated> {
    return this.profiles.list(query, user)
  }

  /** Perfil del propio usuario. Autoservicio para la app del personal. */
  async myProfile(userId: string, hotelId?: string): Promise<EmployeeProfileDTO | null> {
    return this.profiles.mine(userId, hotelId)
  }

  async updateProfile(id: string, data: Partial<CreateEmployeeProfileDTO>, user?: SimpleUser): Promise<EmployeeProfileDTO> {
    return this.profiles.update(id, data, user)
  }

  async deactivateProfile(id: string, user?: SimpleUser): Promise<void> {
    const profile = await this.profiles.getById(id, user)
    await this.profiles.deactivate(id, user)
    this.sockets.onEmployeeDeactivated?.(profile)
  }

  async reactivateProfile(id: string, user?: SimpleUser): Promise<EmployeeProfileDTO> {
    return this.profiles.reactivate(id, user)
  }

  // ─── Contracts ────────────────────────────────────────

  async createContract(dto: CreateContractDTO): Promise<ContractDTO> {
    return this.contracts.create(dto)
  }

  async getContract(id: string, user?: SimpleUser): Promise<ContractDTO> { return this.contracts.getById(id, user) }
  async listContracts(hotelId: string, employeeId?: string): Promise<ContractDTO[]> { return this.contracts.list(hotelId, employeeId) }
  async terminateContract(id: string, user?: SimpleUser): Promise<ContractDTO> { return this.contracts.terminate(id, user) }

  // ─── Documents ────────────────────────────────────────

  async createDocument(dto: CreateDocumentDTO): Promise<DocumentDTO> {
    return this.documents.create(dto)
  }

  async getDocument(id: string, user?: SimpleUser): Promise<DocumentDTO> {
    return this.documents.getById(id, user)
  }

  async listDocuments(hotelId: string, employeeId?: string): Promise<DocumentDTO[]> {
    return this.documents.list(hotelId, employeeId)
  }

  async deleteDocument(id: string, user?: SimpleUser): Promise<void> {
    return this.documents.delete(id, user)
  }

  // ─── Leave Requests ───────────────────────────────────

  async createLeaveRequest(dto: CreateLeaveRequestDTO): Promise<LeaveRequestDTO> {
    return this.leaveRequests.create(dto)
  }

  async getLeaveRequest(id: string, user?: SimpleUser): Promise<LeaveRequestDTO> {
    return this.leaveRequests.getById(id, user)
  }

  async listLeaveRequests(hotelId: string, employeeId?: string, status?: string): Promise<LeaveRequestDTO[]> {
    return this.leaveRequests.list(hotelId, employeeId, status)
  }

  async approveLeaveRequest(id: string, approvedBy: string, user?: SimpleUser): Promise<LeaveRequestDTO> {
    return this.leaveRequests.approve(id, approvedBy, user)
  }

  async rejectLeaveRequest(id: string, approvedBy: string, reason?: string, user?: SimpleUser): Promise<LeaveRequestDTO> {
    return this.leaveRequests.reject(id, approvedBy, reason, user)
  }

  // ─── Performance Reviews ──────────────────────────────

  async createReview(dto: CreatePerformanceReviewDTO): Promise<PerformanceReviewDTO> { return this.reviews.create(dto) }
  async getReview(id: string, user?: SimpleUser): Promise<PerformanceReviewDTO> { return this.reviews.getById(id, user) }
  async listReviews(hotelId: string, employeeId?: string): Promise<PerformanceReviewDTO[]> { return this.reviews.list(hotelId, employeeId) }
  async updateReview(id: string, data: UpdatePerformanceReviewDTO, user?: SimpleUser): Promise<PerformanceReviewDTO> { return this.reviews.update(id, data, user) }
  async completeReview(id: string, user?: SimpleUser): Promise<PerformanceReviewDTO> { return this.reviews.complete(id, user) }

  // ─── Alerts & Org Chart ───────────────────────────────

  async getExpiringDocuments(hotelId: string, daysAhead = 30): Promise<DocumentExpiryAlert[]> {
    return this.documents.getExpiring(hotelId, daysAhead)
  }

  async getOrgChart(hotelId: string): Promise<any> {
    return this.orgChart.getOrgChart(hotelId)
  }
}
