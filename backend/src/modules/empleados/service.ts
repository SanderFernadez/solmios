// empleados/service.ts — Facade pública del módulo Empleados
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import type {
  DepartmentDTO, CreateDepartmentDTO,
  EmployeeProfileDTO, CreateEmployeeProfileDTO,
  ContractDTO, CreateContractDTO,
  DocumentDTO, CreateDocumentDTO,
  LeaveRequestDTO, CreateLeaveRequestDTO,
  PerformanceReviewDTO, CreatePerformanceReviewDTO,
  EmpleadosQuery, EmpleadosPaginated,
  DocumentExpiryAlert,
} from './types'
import type { EmpleadosSockets } from './sockets'
import { DepartmentUseCase } from './usecases/departments'
import { ProfileUseCase } from './usecases/profiles'
import { ContractUseCase } from './usecases/contracts'
import { DocumentUseCase } from './usecases/documents'
import { LeaveRequestUseCase } from './usecases/leave-requests'
import { ReviewUseCase } from './usecases/reviews'
import { OrgChartUseCase } from './usecases/org-chart'

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
  ) {
    this.departments = new DepartmentUseCase(departmentRepo, logger)
    this.profiles = new ProfileUseCase(profileRepo, logger)
    this.contracts = new ContractUseCase(contractRepo, logger)
    this.documents = new DocumentUseCase(documentRepo, logger)
    this.leaveRequests = new LeaveRequestUseCase(leaveRepo, logger)
    this.reviews = new ReviewUseCase(reviewRepo, logger)
    this.orgChart = new OrgChartUseCase(departmentRepo, profileRepo, logger)
  }

  setSockets(s: Partial<EmpleadosSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // ─── Departments ──────────────────────────────────────

  async createDepartment(dto: CreateDepartmentDTO): Promise<DepartmentDTO> {
    return this.departments.create(dto)
  }

  async getDepartment(id: string): Promise<DepartmentDTO> {
    return this.departments.getById(id)
  }

  async listDepartments(hotelId: string): Promise<DepartmentDTO[]> {
    return this.departments.list(hotelId)
  }

  async updateDepartment(id: string, data: Partial<CreateDepartmentDTO>): Promise<DepartmentDTO> {
    return this.departments.update(id, data)
  }

  async deleteDepartment(id: string): Promise<void> {
    return this.departments.delete(id)
  }

  // ─── Employee Profiles ────────────────────────────────

  async createProfile(dto: CreateEmployeeProfileDTO): Promise<EmployeeProfileDTO> {
    return this.profiles.create(dto)
  }

  async getProfile(id: string): Promise<EmployeeProfileDTO> {
    return this.profiles.getById(id)
  }

  async listProfiles(query: EmpleadosQuery): Promise<EmpleadosPaginated> {
    return this.profiles.list(query)
  }

  async updateProfile(id: string, data: Partial<CreateEmployeeProfileDTO>): Promise<EmployeeProfileDTO> {
    return this.profiles.update(id, data)
  }

  async deactivateProfile(id: string): Promise<void> {
    return this.profiles.deactivate(id)
  }

  // ─── Contracts ────────────────────────────────────────

  async createContract(dto: CreateContractDTO): Promise<ContractDTO> {
    return this.contracts.create(dto)
  }

  async getContract(id: string): Promise<ContractDTO> {
    return this.contracts.getById(id)
  }

  async listContracts(hotelId: string, employeeId?: string): Promise<ContractDTO[]> {
    return this.contracts.list(hotelId, employeeId)
  }

  async terminateContract(id: string): Promise<ContractDTO> {
    return this.contracts.terminate(id)
  }

  // ─── Documents ────────────────────────────────────────

  async createDocument(dto: CreateDocumentDTO): Promise<DocumentDTO> {
    return this.documents.create(dto)
  }

  async getDocument(id: string): Promise<DocumentDTO> {
    return this.documents.getById(id)
  }

  async listDocuments(hotelId: string, employeeId?: string): Promise<DocumentDTO[]> {
    return this.documents.list(hotelId, employeeId)
  }

  async deleteDocument(id: string): Promise<void> {
    return this.documents.delete(id)
  }

  // ─── Leave Requests ───────────────────────────────────

  async createLeaveRequest(dto: CreateLeaveRequestDTO): Promise<LeaveRequestDTO> {
    return this.leaveRequests.create(dto)
  }

  async getLeaveRequest(id: string): Promise<LeaveRequestDTO> {
    return this.leaveRequests.getById(id)
  }

  async listLeaveRequests(hotelId: string, employeeId?: string, status?: string): Promise<LeaveRequestDTO[]> {
    return this.leaveRequests.list(hotelId, employeeId, status)
  }

  async approveLeaveRequest(id: string, approvedBy: string): Promise<LeaveRequestDTO> {
    return this.leaveRequests.approve(id, approvedBy)
  }

  async rejectLeaveRequest(id: string, approvedBy: string, reason?: string): Promise<LeaveRequestDTO> {
    return this.leaveRequests.reject(id, approvedBy, reason)
  }

  // ─── Performance Reviews ──────────────────────────────

  async createReview(dto: CreatePerformanceReviewDTO): Promise<PerformanceReviewDTO> {
    return this.reviews.create(dto)
  }

  async getReview(id: string): Promise<PerformanceReviewDTO> {
    return this.reviews.getById(id)
  }

  async listReviews(hotelId: string, employeeId?: string): Promise<PerformanceReviewDTO[]> {
    return this.reviews.list(hotelId, employeeId)
  }

  async completeReview(id: string): Promise<PerformanceReviewDTO> {
    return this.reviews.complete(id)
  }

  // ─── Alerts & Org Chart ───────────────────────────────

  async getExpiringDocuments(hotelId: string, daysAhead = 30): Promise<DocumentExpiryAlert[]> {
    return this.documents.getExpiring(hotelId, daysAhead)
  }

  async getOrgChart(hotelId: string): Promise<any> {
    return this.orgChart.getOrgChart(hotelId)
  }
}
