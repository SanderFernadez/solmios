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
    jobPositionId: { type: 'string' },   // referencia a job_positions (Odoo hr.job)
    managerId: { type: 'string' },
    hireDate: { type: 'string' },
    birthDate: { type: 'string' },
    // ── Datos personales extendidos (Odoo private info) ──
    nationality: { type: 'string' },
    maritalStatus: { type: 'string' },   // single, married, divorced, widowed
    gender: { type: 'string' },
    education: { type: 'string' },
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
    // Referencia al tipo configurable (leave_types). `type` (string) queda por compatibilidad.
    leaveTypeId: { type: 'string' },
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

// ─── Leave Types (tipos de ausencia configurables — paridad Odoo hr_leave_type) ───
const LeaveTypeModel: ModelDefinition = {
  table: 'leave_types',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    code: { type: 'string', required: true },          // vacation, sick_leave, permission…
    name: { type: 'string', required: true },          // etiqueta en español para la UI
    color: { type: 'string', default: '#0891b2' },
    paid: { type: 'boolean', default: 1 },             // con o sin goce de sueldo
    requiresApproval: { type: 'boolean', default: 1 },
    maxDaysPerYear: { type: 'number', default: 0 },    // asignación por defecto (0 = sin límite)
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Leave Allocations (asignación de días por empleado/tipo/año — Odoo hr_leave_allocation) ───
const LeaveAllocationModel: ModelDefinition = {
  table: 'leave_allocations',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    leaveTypeId: { type: 'string', required: true },
    year: { type: 'number', required: true },
    days: { type: 'number', required: true },
    notes: { type: 'string' },
  },
  timestamps: true,
}

// ─── Public Holidays (días festivos por hotel — Odoo resource.calendar.leaves) ───
const PublicHolidayModel: ModelDefinition = {
  table: 'public_holidays',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    date: { type: 'string', required: true },          // YYYY-MM-DD
    name: { type: 'string', required: true },
    recurring: { type: 'boolean', default: 0 },         // se repite cada año (mismo mes/día)
  },
  timestamps: true,
}

// ─── Performance Reviews (Evaluaciones — paridad Odoo hr_appraisal) ───
const PerformanceReviewModel: ModelDefinition = {
  table: 'performance_reviews',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    reviewerId: { type: 'string', required: true },
    period: { type: 'string' },
    reviewDate: { type: 'string', required: true },
    // ── Evaluación del manager ──
    score: { type: 'number' },
    strengths: { type: 'string' },
    improvements: { type: 'string' },
    goals: { type: 'string' },
    notes: { type: 'string' },
    // ── Auto-evaluación del empleado (Odoo: employee self-assessment) ──
    selfScore: { type: 'number' },
    selfComments: { type: 'string' },
    // ── Plantilla + respuestas a sus preguntas (JSON) ──
    templateId: { type: 'string' },
    answers: { type: 'string' },
    acknowledged: { type: 'boolean', default: 0 }, // el empleado confirmó haber leído la evaluación
    status: { type: 'string', default: 'draft' },
  },
  timestamps: true,
}

// ─── Appraisal Templates (formularios de evaluación configurables) ───
const AppraisalTemplateModel: ModelDefinition = {
  table: 'appraisal_templates',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    questions: { type: 'string', required: true }, // JSON: string[] con las preguntas
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Job Positions (puestos con vacantes — Odoo hr.job) ───
const JobPositionModel: ModelDefinition = {
  table: 'job_positions',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    departmentId: { type: 'string' },
    description: { type: 'string' },
    expectedEmployees: { type: 'number', default: 1 }, // dotación objetivo del puesto
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Contract Types (tipos de contrato configurables — Odoo hr.contract.type) ───
const ContractTypeModel: ModelDefinition = {
  table: 'contract_types',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    code: { type: 'string', required: true },
    name: { type: 'string', required: true },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Work Locations (ubicaciones de trabajo — Odoo hr.work.location) ───
const WorkLocationModel: ModelDefinition = {
  table: 'work_locations',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    address: { type: 'string' },
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

// ─── Performance Eval Config (reglas y tiempos del motor automático — #322) ───
// Config por hotel del motor de evaluación de desempeño (#321): pesos por criterio,
// umbrales de banda y el tiempo estándar por tarea de limpieza. weights/thresholds
// son JSON (el ORM los (de)serializa solo). NO va en shared: es dueño el módulo empleados.
const PerformanceEvalConfigModel: ModelDefinition = {
  table: 'performance_eval_config',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    period: { type: 'string', default: 'monthly' },          // 'monthly' | 'quarterly'
    weights: { type: 'json' },                                 // {productivity,quality,punctuality,attendance} suman 100
    thresholds: { type: 'json' },                              // {excellent,good,fair} descendentes
    standardTaskMinutes: { type: 'number', default: 30 },      // tiempo estándar por tarea (score productividad housekeeping)
    standardResolutionHours: { type: 'number', default: 24 },  // horas estándar de resolución (score productividad mantenimiento, #321)
    enabled: { type: 'boolean', default: 1 },
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
  orm.define('LeaveType', LeaveTypeModel)
  orm.define('LeaveAllocation', LeaveAllocationModel)
  orm.define('PublicHoliday', PublicHolidayModel)
  orm.define('AppraisalTemplate', AppraisalTemplateModel)
  orm.define('JobPosition', JobPositionModel)
  orm.define('ContractType', ContractTypeModel)
  orm.define('WorkLocation', WorkLocationModel)
  orm.define('PerformanceEvalConfig', PerformanceEvalConfigModel)
}
