// empleados/model.ts — 6 tablas RRHH
// Tablas en INGLÉS (regla obligatoria)

import type { ModelDefinition, ORM } from 'arckode-framework'

// ─── Departments (Organigrama) ──────────────────────────
const DepartmentModel: ModelDefinition = {
  table: 'departments',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    description: { type: 'string' },
    managerId: { type: 'string' },
    parentId: { type: 'string' },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Employee Profiles (Expediente digital) ─────────────
const EmployeeProfileModel: ModelDefinition = {
  table: 'employee_profiles',
  fields: {
    userId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    departmentId: { type: 'string' },
    position: { type: 'string' },
    managerId: { type: 'string' },
    hireDate: { type: 'string' },
    salary: { type: 'number' },
    contractType: { type: 'string' },
    documentNumber: { type: 'string' },
    documentType: { type: 'string' },
    documentExpiry: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    country: { type: 'string' },
    emergencyContactName: { type: 'string' },
    emergencyContactPhone: { type: 'string' },
    emergencyContactRelation: { type: 'string' },
    bankName: { type: 'string' },
    bankAccount: { type: 'string' },
    vacationDaysTotal: { type: 'number', default: 15 },
    vacationDaysUsed: { type: 'number', default: 0 },
    notes: { type: 'string' },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Employee Contracts ─────────────────────────────────
const ContractModel: ModelDefinition = {
  table: 'employee_contracts',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    type: { type: 'string', required: true },
    startDate: { type: 'string', required: true },
    endDate: { type: 'string' },
    salary: { type: 'number', required: true },
    currency: { type: 'string', default: 'USD' },
    position: { type: 'string' },
    departmentId: { type: 'string' },
    status: { type: 'string', default: 'active' },
    signedAt: { type: 'string' },
    notes: { type: 'string' },
  },
  timestamps: true,
}

// ─── Employee Documents ─────────────────────────────────
const DocumentModel: ModelDefinition = {
  table: 'employee_documents',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    type: { type: 'string', required: true },
    name: { type: 'string', required: true },
    fileUrl: { type: 'string' },
    expiryDate: { type: 'string' },
    issuedBy: { type: 'string' },
    notes: { type: 'string' },
    alertSent: { type: 'boolean', default: 0 },
  },
  timestamps: true,
}

// ─── Leave Requests (Vacaciones, permisos, licencias) ───
const LeaveRequestModel: ModelDefinition = {
  table: 'leave_requests',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    type: { type: 'string', required: true },
    startDate: { type: 'string', required: true },
    endDate: { type: 'string', required: true },
    days: { type: 'number', required: true },
    reason: { type: 'string' },
    status: { type: 'string', default: 'pending' },
    approvedBy: { type: 'string' },
    approvedAt: { type: 'string' },
    notes: { type: 'string' },
  },
  timestamps: true,
}

// ─── Performance Reviews ────────────────────────────────
const PerformanceReviewModel: ModelDefinition = {
  table: 'performance_reviews',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    reviewerId: { type: 'string', required: true },
    period: { type: 'string' },
    reviewDate: { type: 'string', required: true },
    score: { type: 'number' },
    strengths: { type: 'string' },
    improvements: { type: 'string' },
    goals: { type: 'string' },
    notes: { type: 'string' },
    status: { type: 'string', default: 'draft' },
  },
  timestamps: true,
}

// ─── Register all models ────────────────────────────────
export function registerEmpleadosModels(orm: ORM): void {
  orm.define('Department', DepartmentModel)
  orm.define('EmployeeProfile', EmployeeProfileModel)
  orm.define('EmployeeContract', ContractModel)
  orm.define('EmployeeDocument', DocumentModel)
  orm.define('LeaveRequest', LeaveRequestModel)
  orm.define('PerformanceReview', PerformanceReviewModel)
}
