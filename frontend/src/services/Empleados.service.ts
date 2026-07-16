// services/Empleados.service.ts — API client para módulo empleados

import { http } from './http'

export interface Department {
  id: string
  name: string
  description: string
  managerId: string | null
  parentId: string | null
  active: number
}

export interface EmployeeProfile {
  id: string
  userId: string
  userName?: string
  userRole?: string
  hotelId: string
  departmentId: string | null
  position: string
  jobPositionId: string | null
  managerId: string | null
  hireDate: string
  birthDate: string
  nationality: string
  maritalStatus: string
  gender: string
  education: string
  salary: number
  contractType: string
  documentNumber: string
  documentType: string
  documentExpiry: string
  address: string
  city: string
  country: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  bankName: string
  bankAccount: string
  vacationDaysTotal: number
  vacationDaysUsed: number
  notes: string
  active: number
}

export interface Contract {
  id: string
  hotelId: string
  employeeId: string
  type: string
  startDate: string
  endDate: string | null
  salary: number
  currency: string
  position: string
  departmentId: string | null
  status: string
  signedAt: string | null
  notes: string
}

export interface EmployeeDocument {
  id: string
  hotelId: string
  employeeId: string
  type: string
  name: string
  fileUrl: string
  expiryDate: string | null
  issuedBy: string
  notes: string
  alertSent: number
}

export interface LeaveRequest {
  id: string
  hotelId: string
  employeeId: string
  type: string
  leaveTypeId: string | null
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy: string | null
  approvedAt: string | null
  notes: string
}

export interface LeaveType {
  id: string
  hotelId: string
  code: string
  name: string
  color: string
  paid: number
  requiresApproval: number
  maxDaysPerYear: number
  active: number
}

export interface LeaveAllocation {
  id: string
  hotelId: string
  employeeId: string
  leaveTypeId: string
  year: number
  days: number
  notes: string
}

export interface PublicHoliday {
  id: string
  hotelId: string
  date: string
  name: string
  recurring: number
}

export interface LeaveBalance {
  leaveTypeId: string
  code: string
  name: string
  color: string
  allocated: number
  used: number
  pending: number
  remaining: number
}

export interface PerformanceReview {
  id: string
  hotelId: string
  employeeId: string
  reviewerId: string
  period: string
  reviewDate: string
  score: number | null
  strengths: string
  improvements: string
  goals: string
  notes: string
  selfScore: number | null
  selfComments: string
  templateId: string | null
  answers: string
  acknowledged: number
  status: string
}

export interface AppraisalTemplate {
  id: string
  hotelId: string
  name: string
  questions: string
  active: number
}

export interface JobPosition {
  id: string
  hotelId: string
  name: string
  departmentId: string | null
  description: string
  expectedEmployees: number
  active: number
}

export interface ContractType {
  id: string
  hotelId: string
  code: string
  name: string
  active: number
}

export interface WorkLocation {
  id: string
  hotelId: string
  name: string
  address: string
  active: number
}

export interface OrgChartNode {
  id: string
  name: string
  description: string
  managerId: string | null
  employees: EmployeeProfile[]
  children: OrgChartNode[]
}

export interface DocumentExpiryAlert {
  employeeId: string
  employeeName: string
  documentId: string
  documentName: string
  type: string
  expiryDate: string
  daysUntilExpiry: number
}

export const EmpleadosService = {
  // Departments
  async listDepartments(): Promise<Department[]> { return http.get('/api/departments') },
  async getDepartment(id: string): Promise<Department> { return http.get(`/api/departments/${id}`) },
  async createDepartment(data: Partial<Department>): Promise<Department> { return http.post('/api/departments', data) },
  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> { return http.put(`/api/departments/${id}`, data) },
  async deleteDepartment(id: string): Promise<void> { return http.delete(`/api/departments/${id}`) },

  // Profiles
  async listProfiles(params?: Record<string, any>): Promise<{ data: EmployeeProfile[]; total: number }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get(`/api/employee-profiles${qs}`)
  },
  async getProfile(id: string): Promise<EmployeeProfile> { return http.get(`/api/employee-profiles/${id}`) },
  async createProfile(data: Partial<EmployeeProfile>): Promise<EmployeeProfile> { return http.post('/api/employee-profiles', data) },
  async updateProfile(id: string, data: Partial<EmployeeProfile>): Promise<EmployeeProfile> { return http.put(`/api/employee-profiles/${id}`, data) },
  async deactivateProfile(id: string): Promise<void> { return http.delete(`/api/employee-profiles/${id}`) },
  async reactivateProfile(id: string): Promise<EmployeeProfile> { return http.post(`/api/employee-profiles/${id}/reactivate`) },

  // Contracts
  async listContracts(employeeId?: string, hotelId?: string): Promise<Contract[]> {
    const params = new URLSearchParams()
    if (employeeId) params.set('employeeId', employeeId)
    if (hotelId) params.set('hotelId', hotelId)
    const qs = params.toString() ? `?${params}` : ''
    return http.get(`/api/employee-contracts${qs}`)
  },
  async getContract(id: string): Promise<Contract> { return http.get(`/api/employee-contracts/${id}`) },
  async createContract(data: Partial<Contract>): Promise<Contract> { return http.post('/api/employee-contracts', data) },
  async terminateContract(id: string): Promise<Contract> { return http.post(`/api/employee-contracts/${id}/terminate`) },

  // Documents
  async listDocuments(employeeId?: string, hotelId?: string): Promise<EmployeeDocument[]> {
    const params = new URLSearchParams()
    if (employeeId) params.set('employeeId', employeeId)
    if (hotelId) params.set('hotelId', hotelId)
    const qs = params.toString() ? `?${params}` : ''
    return http.get(`/api/employee-documents${qs}`)
  },
  async getDocument(id: string): Promise<EmployeeDocument> { return http.get(`/api/employee-documents/${id}`) },
  async createDocument(data: Partial<EmployeeDocument> & { fileData?: string; fileName?: string }): Promise<EmployeeDocument> { return http.post('/api/employee-documents', data) },
  async deleteDocument(id: string): Promise<void> { return http.delete(`/api/employee-documents/${id}`) },
  async getExpiringDocuments(days?: number): Promise<DocumentExpiryAlert[]> {
    return http.get(`/api/employee-documents/expiring?days=${days ?? 30}`)
  },

  // Leave Requests
  async listLeaveRequests(params?: Record<string, any>): Promise<LeaveRequest[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get(`/api/leave-requests${qs}`)
  },
  async createLeaveRequest(data: Partial<LeaveRequest>): Promise<LeaveRequest> { return http.post('/api/leave-requests', data) },
  async approveLeaveRequest(id: string): Promise<LeaveRequest> { return http.post(`/api/leave-requests/${id}/approve`) },
  async rejectLeaveRequest(id: string, reason: string): Promise<LeaveRequest> { return http.post(`/api/leave-requests/${id}/reject`, { reason }) },

  // ── Time Off config (Odoo parity) ──
  async listLeaveTypes(): Promise<LeaveType[]> { return http.get('/api/leave-types') },
  async createLeaveType(data: Partial<LeaveType>): Promise<LeaveType> { return http.post('/api/leave-types', data) },
  async updateLeaveType(id: string, data: Partial<LeaveType>): Promise<LeaveType> { return http.put(`/api/leave-types/${id}`, data) },
  async deleteLeaveType(id: string): Promise<void> { return http.delete(`/api/leave-types/${id}`) },
  async listLeaveAllocations(params?: Record<string, any>): Promise<LeaveAllocation[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get(`/api/leave-allocations${qs}`)
  },
  async createLeaveAllocation(data: Partial<LeaveAllocation>): Promise<LeaveAllocation> { return http.post('/api/leave-allocations', data) },
  async deleteLeaveAllocation(id: string): Promise<void> { return http.delete(`/api/leave-allocations/${id}`) },
  async listPublicHolidays(year?: number): Promise<PublicHoliday[]> { return http.get(`/api/public-holidays${year ? `?year=${year}` : ''}`) },
  async createPublicHoliday(data: Partial<PublicHoliday>): Promise<PublicHoliday> { return http.post('/api/public-holidays', data) },
  async deletePublicHoliday(id: string): Promise<void> { return http.delete(`/api/public-holidays/${id}`) },
  async getLeaveBalance(employeeId: string, year?: number): Promise<LeaveBalance[]> { return http.get(`/api/leave-balance/${employeeId}${year ? `?year=${year}` : ''}`) },
  async getLeaveCalendar(from: string, to: string): Promise<LeaveRequest[]> { return http.get(`/api/leave-calendar?from=${from}&to=${to}`) },

  // Performance Reviews
  async listReviews(employeeId?: string, hotelId?: string): Promise<PerformanceReview[]> {
    const params = new URLSearchParams()
    if (employeeId) params.set('employeeId', employeeId)
    if (hotelId) params.set('hotelId', hotelId)
    const qs = params.toString() ? `?${params}` : ''
    return http.get(`/api/performance-reviews${qs}`)
  },
  async createReview(data: Partial<PerformanceReview>): Promise<PerformanceReview> { return http.post('/api/performance-reviews', data) },
  async updateReview(id: string, data: Partial<PerformanceReview>): Promise<PerformanceReview> { return http.put(`/api/performance-reviews/${id}`, data) },
  async completeReview(id: string): Promise<PerformanceReview> { return http.post(`/api/performance-reviews/${id}/complete`) },
  async listAppraisalTemplates(): Promise<AppraisalTemplate[]> { return http.get('/api/appraisal-templates') },
  async createAppraisalTemplate(data: { name: string; questions: string[] }): Promise<AppraisalTemplate> { return http.post('/api/appraisal-templates', data) },
  async deleteAppraisalTemplate(id: string): Promise<void> { return http.delete(`/api/appraisal-templates/${id}`) },

  // ── Catálogos RRHH (Odoo parity) ──
  async listJobPositions(): Promise<JobPosition[]> { return http.get('/api/job-positions') },
  async createJobPosition(data: Partial<JobPosition>): Promise<JobPosition> { return http.post('/api/job-positions', data) },
  async deleteJobPosition(id: string): Promise<void> { return http.delete(`/api/job-positions/${id}`) },
  async listContractTypes(): Promise<ContractType[]> { return http.get('/api/contract-types') },
  async createContractType(data: { code: string; name: string }): Promise<ContractType> { return http.post('/api/contract-types', data) },
  async listWorkLocations(): Promise<WorkLocation[]> { return http.get('/api/work-locations') },
  async createWorkLocation(data: { name: string; address?: string }): Promise<WorkLocation> { return http.post('/api/work-locations', data) },

  // Org Chart
  async getOrgChart(): Promise<{ departments: OrgChartNode[]; totalEmployees: number }> { return http.get('/api/org-chart') },

  // Dashboard RRHH (resumen consolidado)
  async getDashboard(): Promise<HrDashboard> { return http.get('/api/hr-dashboard') },

  // Expediente integral consolidado por empleado (#323)
  async getDossier(id: string): Promise<EmployeeDossier> { return http.get(`/api/employee-profiles/${id}/dossier`) },

  // ── Evaluación de desempeño: config (#322) + motor automático (#321) ──
  async getEvalConfig(): Promise<PerformanceEvalConfig> { return http.get('/api/performance-eval/config') },
  async updateEvalConfig(data: UpdatePerformanceEvalConfig): Promise<PerformanceEvalConfig> { return http.put('/api/performance-eval/config', data) },
  async runEvaluation(period?: EvalPeriodType): Promise<AutoEvalSummary> { return http.post('/api/performance-eval/run', period ? { period } : {}) },
  async listEvalResults(period?: string): Promise<PerformanceReview[]> { return http.get(`/api/performance-eval/results${period ? `?period=${encodeURIComponent(period)}` : ''}`) },
}

// ── Expediente integral (#323) ──
export interface DossierEvalSummary {
  latestScore: number | null
  band: EvalBand | null
  period: string | null
  reviewDate: string | null
  breakdown: EvalBreakdown | null
  totalAutomatic: number
}

export interface EmployeeDossier {
  profile: EmployeeProfile
  contracts: Contract[]
  documents: EmployeeDocument[]
  leaveRequests: LeaveRequest[]
  reviews: PerformanceReview[]
  evalSummary: DossierEvalSummary | null
}

// ── Evaluación de desempeño (#321/#322) ──
export type EvalPeriodType = 'monthly' | 'quarterly'
export type EvalBand = 'excellent' | 'good' | 'fair' | 'poor'

export interface EvalWeights {
  productivity: number
  quality: number
  punctuality: number
  attendance: number
}

export interface EvalThresholds {
  excellent: number
  good: number
  fair: number
}

export interface EvalCriterionResult {
  score: number
  weight: number
  hasData: boolean
}

export interface EvalBreakdown {
  productivity: EvalCriterionResult
  quality: EvalCriterionResult
  punctuality: EvalCriterionResult
  attendance: EvalCriterionResult
}

export interface PerformanceEvalConfig {
  id: string
  hotelId: string
  period: EvalPeriodType
  weights: EvalWeights
  thresholds: EvalThresholds
  standardTaskMinutes: number
  enabled: number
}

export interface UpdatePerformanceEvalConfig {
  period?: EvalPeriodType
  weights?: EvalWeights
  thresholds?: EvalThresholds
  standardTaskMinutes?: number
  enabled?: boolean
}

export interface AutoEvalResult {
  employeeId: string
  reviewId: string
  score: number
  band: EvalBand
  breakdown: EvalBreakdown
}

export interface AutoEvalSummary {
  hotelId: string
  period: string
  periodType: EvalPeriodType
  evaluated: number
  skipped: number
  results: AutoEvalResult[]
}

export interface HrDashboard {
  headcount: number
  byDepartment: { departmentId: string; name: string; count: number }[]
  contracts: { active: number; expiringSoon: number }
  documentsExpiring: number
  leaves: { pending: number; upcomingApproved: number }
  reviews: { pending: number; avgScore: number | null }
  newHiresThisMonth: number
  birthdaysThisMonth: { employeeId: string; name: string; date: string; day: number }[]
  onLeaveToday: { employeeId: string; name: string; type: string; startDate: string; endDate: string }[]
  topPerformers: { employeeId: string; name: string; avgScore: number; reviews: number }[]
  occupancy: { total: number; available: number; onLeave: number; inactive: number }
  pending: { contractsExpiring: number; documentsExpiring: number; leavesPending: number; reviewsPending: number }
  attendance: { present: number; absent: number; late: number } | null
}
