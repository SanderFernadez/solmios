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
  /** Nombre del usuario (join con la tabla users). Lo agrega `list()` — no es columna de la tabla. */
  userName?: string
  /** Rol del usuario (join). Lo agrega `list()`. Permite mostrar el rol en la UI (#172). */
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
  birthDate?: string
  jobPositionId?: string
  nationality?: string
  maritalStatus?: string
  gender?: string
  education?: string
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
  leaveTypeId: string | null
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
  leaveTypeId?: string
  startDate: string
  endDate: string
  /** Opcional: si no viene, el servidor lo calcula desde el rango (días calendario − festivos). */
  days?: number
  reason?: string
  notes?: string
}

// ─── Leave Type (tipo de ausencia configurable) ─────────
export interface LeaveTypeDTO {
  id: string
  hotelId: string
  code: string
  name: string
  color: string
  paid: number
  requiresApproval: number
  maxDaysPerYear: number
  active: number
  createdAt: string
  updatedAt: string
}
export interface CreateLeaveTypeDTO {
  hotelId: string
  code: string
  name: string
  color?: string
  paid?: boolean
  requiresApproval?: boolean
  maxDaysPerYear?: number
}

// ─── Leave Allocation (asignación de días) ──────────────
export interface LeaveAllocationDTO {
  id: string
  hotelId: string
  employeeId: string
  leaveTypeId: string
  year: number
  days: number
  notes: string
  createdAt: string
  updatedAt: string
}
export interface CreateLeaveAllocationDTO {
  hotelId: string
  employeeId: string
  leaveTypeId: string
  year: number
  days: number
  notes?: string
}

// ─── Public Holiday (día festivo) ───────────────────────
export interface PublicHolidayDTO {
  id: string
  hotelId: string
  date: string
  name: string
  recurring: number
  createdAt: string
  updatedAt: string
}
export interface CreatePublicHolidayDTO {
  hotelId: string
  date: string
  name: string
  recurring?: boolean
}

// ─── Leave Balance (saldo por tipo, calculado) ──────────
export interface LeaveBalanceDTO {
  leaveTypeId: string
  code: string
  name: string
  color: string
  allocated: number
  used: number
  pending: number
  remaining: number
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
  selfScore: number | null
  selfComments: string
  templateId: string | null
  answers: string
  acknowledged: number
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
  selfScore?: number
  selfComments?: string
  templateId?: string
  answers?: string
}

/** Editar una evaluación en borrador (#193). Sin hotelId/employeeId: no se reasigna dueño. */
export interface UpdatePerformanceReviewDTO {
  period?: string
  reviewDate?: string
  score?: number
  strengths?: string
  improvements?: string
  goals?: string
  notes?: string
  selfScore?: number
  selfComments?: string
  templateId?: string
  answers?: string
  acknowledged?: boolean
}

// ─── Appraisal Template (formulario de evaluación) ──────
export interface AppraisalTemplateDTO {
  id: string
  hotelId: string
  name: string
  questions: string
  active: number
  createdAt: string
  updatedAt: string
}
export interface CreateAppraisalTemplateDTO {
  hotelId: string
  name: string
  questions: string[] | string
}

// ─── Job Position (puesto) ──────────────────────────────
export interface JobPositionDTO {
  id: string
  hotelId: string
  name: string
  departmentId: string | null
  description: string
  expectedEmployees: number
  active: number
  createdAt: string
  updatedAt: string
}
export interface CreateJobPositionDTO {
  hotelId: string
  name: string
  departmentId?: string
  description?: string
  expectedEmployees?: number
}

// ─── Contract Type (tipo de contrato) ───────────────────
export interface ContractTypeDTO {
  id: string
  hotelId: string
  code: string
  name: string
  active: number
  createdAt: string
  updatedAt: string
}
export interface CreateContractTypeDTO {
  hotelId: string
  code: string
  name: string
}

// ─── Work Location (ubicación de trabajo) ───────────────
export interface WorkLocationDTO {
  id: string
  hotelId: string
  name: string
  address: string
  active: number
  createdAt: string
  updatedAt: string
}
export interface CreateWorkLocationDTO {
  hotelId: string
  name: string
  address?: string
}

// ─── Performance Eval Config (motor automático — #322) ──
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
export type EvalPeriodType = 'monthly' | 'quarterly'

export interface PerformanceEvalConfigDTO {
  id: string
  hotelId: string
  period: EvalPeriodType
  weights: EvalWeights
  thresholds: EvalThresholds
  standardTaskMinutes: number
  /** Horas estándar de resolución de un ticket de mantenimiento (criterio maintenance, #321). Opcional
   *  por retrocompat: las configs viejas no lo tienen → el motor cae a un default. */
  standardResolutionHours?: number
  enabled: number
  createdAt: string
  updatedAt: string
}

export interface UpdatePerformanceEvalConfigDTO {
  period?: EvalPeriodType
  weights?: EvalWeights
  thresholds?: EvalThresholds
  standardTaskMinutes?: number
  standardResolutionHours?: number
  enabled?: boolean
}

// ─── Auto-evaluation engine (#321) ──────────────────────
export type EvalBand = 'excellent' | 'good' | 'fair' | 'poor'

/** Desglose de un criterio: su score 0-100, el peso aplicado y si tuvo data para computarse. */
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
  /** Productividad de mantenimiento (técnicos). Opcional: solo presente si el criterio corrió. */
  maintenance?: EvalCriterionResult
  /** DT-19: cursos completados en el período (score = promedio de la nota 0-100). Opcional. */
  training?: EvalCriterionResult
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

// ─── Queries ────────────────────────────────────────────
export interface EmpleadosQuery {
  hotelId?: string
  departmentId?: string
  active?: boolean
  includeInactive?: boolean
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
