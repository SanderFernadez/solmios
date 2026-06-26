// empleados/types.ts — DTOs y tipos

// ─── Department ─────────────────────────────────────────
export interface DepartmentDTO {
  id: string
  hotelId: string
  name: string
  description: string
  managerId: string | null
  parentId: string | null
  active: number
  createdAt: string
  updatedAt: string
}

export interface CreateDepartmentDTO {
  hotelId: string
  name: string
  description?: string
  managerId?: string
  parentId?: string
}

// ─── Employee Profile ───────────────────────────────────
export interface EmployeeProfileDTO {
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
  createdAt: string
  updatedAt: string
}

export interface CreateEmployeeProfileDTO {
  userId: string
  hotelId: string
  departmentId?: string
  position?: string
  managerId?: string
  hireDate?: string
  salary?: number
  contractType?: string
  documentNumber?: string
  documentType?: string
  documentExpiry?: string
  address?: string
  city?: string
  country?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  bankName?: string
  bankAccount?: string
  vacationDaysTotal?: number
  notes?: string
}

// ─── Contract ───────────────────────────────────────────
export interface ContractDTO {
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
  createdAt: string
  updatedAt: string
}

export interface CreateContractDTO {
  hotelId: string
  employeeId: string
  type: string
  startDate: string
  endDate?: string
  salary: number
  currency?: string
  position?: string
  departmentId?: string
  notes?: string
}

// ─── Document ───────────────────────────────────────────
export interface DocumentDTO {
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
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentDTO {
  hotelId: string
  employeeId: string
  type: string
  name: string
  fileUrl?: string
  expiryDate?: string
  issuedBy?: string
  notes?: string
}

// ─── Leave Request ──────────────────────────────────────
export interface LeaveRequestDTO {
  id: string
  hotelId: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: string
  approvedBy: string | null
  approvedAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateLeaveRequestDTO {
  hotelId: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  days: number
  reason?: string
  notes?: string
}

// ─── Performance Review ─────────────────────────────────
export interface PerformanceReviewDTO {
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
  createdAt: string
  updatedAt: string
}

export interface CreatePerformanceReviewDTO {
  hotelId: string
  employeeId: string
  reviewerId: string
  period?: string
  reviewDate: string
  score?: number
  strengths?: string
  improvements?: string
  goals?: string
  notes?: string
}

// ─── Queries ────────────────────────────────────────────
export interface EmpleadosQuery {
  hotelId?: string
  departmentId?: string
  active?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface EmpleadosPaginated {
  data: EmployeeProfileDTO[]
  total: number
  page: number
  limit: number
}

// ─── Document Expiry Alert ──────────────────────────────
export interface DocumentExpiryAlert {
  employeeId: string
  employeeName: string
  documentId: string
  documentName: string
  type: string
  expiryDate: string
  daysUntilExpiry: number
}
