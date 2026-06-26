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
  hotelId: string
  departmentId: string | null
  position: string
  managerId: string | null
  hireDate: string
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
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy: string | null
  approvedAt: string | null
  notes: string
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
  status: string
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

  // Contracts
  async listContracts(employeeId?: string): Promise<Contract[]> {
    const qs = employeeId ? `?employeeId=${employeeId}` : ''
    return http.get(`/api/employee-contracts${qs}`)
  },
  async getContract(id: string): Promise<Contract> { return http.get(`/api/employee-contracts/${id}`) },
  async createContract(data: Partial<Contract>): Promise<Contract> { return http.post('/api/employee-contracts', data) },
  async terminateContract(id: string): Promise<Contract> { return http.post(`/api/employee-contracts/${id}/terminate`) },

  // Documents
  async listDocuments(employeeId?: string): Promise<EmployeeDocument[]> {
    const qs = employeeId ? `?employeeId=${employeeId}` : ''
    return http.get(`/api/employee-documents${qs}`)
  },
  async getDocument(id: string): Promise<EmployeeDocument> { return http.get(`/api/employee-documents/${id}`) },
  async createDocument(data: Partial<EmployeeDocument>): Promise<EmployeeDocument> { return http.post('/api/employee-documents', data) },
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
  async rejectLeaveRequest(id: string, reason?: string): Promise<LeaveRequest> { return http.post(`/api/leave-requests/${id}/reject`, { reason }) },

  // Performance Reviews
  async listReviews(employeeId?: string): Promise<PerformanceReview[]> {
    const qs = employeeId ? `?employeeId=${employeeId}` : ''
    return http.get(`/api/performance-reviews${qs}`)
  },
  async createReview(data: Partial<PerformanceReview>): Promise<PerformanceReview> { return http.post('/api/performance-reviews', data) },
  async completeReview(id: string): Promise<PerformanceReview> { return http.post(`/api/performance-reviews/${id}/complete`) },

  // Org Chart
  async getOrgChart(): Promise<{ departments: OrgChartNode[]; totalEmployees: number }> { return http.get('/api/org-chart') },
}
