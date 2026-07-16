// empleados/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { bodyLimit } from 'arckode-framework/middlewares'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerEmpleadosModels } from './model'
import { EmpleadosService } from './service'
import { EmpleadosController } from './controller'
import { DashboardUseCase } from './usecases/dashboard'
import { LeaveConfigUseCase } from './usecases/leave-config'
import { AppraisalConfigUseCase } from './usecases/appraisal-config'
import { HrCatalogUseCase } from './usecases/hr-catalog'
import { EvalConfigUseCase } from './usecases/eval-config'
import { AutoEvaluationUseCase } from './usecases/auto-evaluation'
import { DossierUseCase } from './usecases/dossier'

/** Un documento del expediente (PDF/imagen) en base64: 10 MB de sobra. */
const DOCUMENT_UPLOAD_LIMIT = 10 * 1024 * 1024
import type {
  DepartmentDTO, EmployeeProfileDTO, ContractDTO,
  DocumentDTO, LeaveRequestDTO, PerformanceReviewDTO,
  LeaveTypeDTO, LeaveAllocationDTO, PublicHolidayDTO, AppraisalTemplateDTO,
  JobPositionDTO, ContractTypeDTO, WorkLocationDTO, PerformanceEvalConfigDTO,
} from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

/** Todo el personal del hotel puede leer su propio perfil. */
const STAFF_ROLES: [string, ...string[]] = [
  'hotel_admin', 'receptionist', 'housekeeper', 'maintenance', 'supervisor', 'super_admin',
]

export { EmpleadosService }
export type {
  DepartmentDTO, EmployeeProfileDTO, ContractDTO,
  DocumentDTO, LeaveRequestDTO, PerformanceReviewDTO,
  CreateDepartmentDTO, CreateEmployeeProfileDTO, CreateContractDTO,
  CreateDocumentDTO, CreateLeaveRequestDTO, CreatePerformanceReviewDTO,
  EmpleadosQuery, EmpleadosPaginated, DocumentExpiryAlert,
  PerformanceEvalConfigDTO, UpdatePerformanceEvalConfigDTO, AutoEvalSummary, AutoEvalResult,
} from './types'
export type { EmpleadosSockets } from './sockets'
export type { HkStatsPort, AttendanceStatsPort } from './usecases/auto-evaluation'

export function EmpleadosModule(opts: { storage?: StorageService } = {}) {
  return createModule({
    name: 'empleados',
    version: '1.0.0',
    description: 'Gestión de empleados: expediente, contratos, documentos, vacaciones, evaluaciones, organigrama',

    contract: {
      name: 'empleados',
      version: '1.0.0',
      description: 'Gestión RRHH completa',
      actions: [
        'createDepartment', 'listDepartments', 'getDepartment', 'updateDepartment', 'deleteDepartment',
        'createProfile', 'listProfiles', 'getProfile', 'updateProfile', 'deactivateProfile', 'reactivateProfile',
        'createContract', 'listContracts', 'getContract', 'terminateContract',
        'createDocument', 'listDocuments', 'getDocument', 'deleteDocument',
        'createLeaveRequest', 'listLeaveRequests', 'approveLeaveRequest', 'rejectLeaveRequest',
        'createReview', 'listReviews', 'getReview', 'updateReview', 'completeReview',
        'listAppraisalTemplates', 'createAppraisalTemplate', 'updateAppraisalTemplate', 'deleteAppraisalTemplate',
        'listJobPositions', 'createJobPosition', 'updateJobPosition', 'deleteJobPosition',
        'listContractTypes', 'createContractType', 'deleteContractType',
        'listWorkLocations', 'createWorkLocation', 'deleteWorkLocation',
        'getExpiringDocuments', 'getOrgChart', 'getEmployeeDossier',
        'listLeaveTypes', 'createLeaveType', 'updateLeaveType', 'deleteLeaveType',
        'listLeaveAllocations', 'createLeaveAllocation', 'deleteLeaveAllocation',
        'listPublicHolidays', 'createPublicHoliday', 'deletePublicHoliday',
        'getLeaveBalance', 'getLeaveCalendar',
        'getEvalConfig', 'updateEvalConfig', 'runAutoEvaluation', 'listEvalResults',
      ],
      events: [
        'onEmployeeCreated', 'onEmployeeDeactivated',
        'onDocumentExpiring', 'onLeaveRequestPending',
      ],
      tables: ['departments', 'employee_profiles', 'employee_contracts', 'employee_documents', 'leave_requests', 'performance_reviews', 'leave_types', 'leave_allocations', 'public_holidays', 'appraisal_templates', 'job_positions', 'contract_types', 'work_locations', 'performance_eval_config'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('empleados: auth dependency required')
      registerEmpleadosModels(orm)

      const departmentRepo = new OrmRepository<DepartmentDTO>(orm, 'Department')
      const profileRepo = new OrmRepository<EmployeeProfileDTO>(orm, 'EmployeeProfile')
      const contractRepo = new OrmRepository<ContractDTO>(orm, 'EmployeeContract')
      const documentRepo = new OrmRepository<DocumentDTO>(orm, 'EmployeeDocument')
      const leaveRepo = new OrmRepository<LeaveRequestDTO>(orm, 'LeaveRequest')
      const reviewRepo = new OrmRepository<PerformanceReviewDTO>(orm, 'PerformanceReview')
      const leaveTypeRepo = new OrmRepository<LeaveTypeDTO>(orm, 'LeaveType')
      const allocationRepo = new OrmRepository<LeaveAllocationDTO>(orm, 'LeaveAllocation')
      const holidayRepo = new OrmRepository<PublicHolidayDTO>(orm, 'PublicHoliday')
      const templateRepo = new OrmRepository<AppraisalTemplateDTO>(orm, 'AppraisalTemplate')
      const jobRepo = new OrmRepository<JobPositionDTO>(orm, 'JobPosition')
      const contractTypeRepo = new OrmRepository<ContractTypeDTO>(orm, 'ContractType')
      const locationRepo = new OrmRepository<WorkLocationDTO>(orm, 'WorkLocation')
      const evalConfigRepo = new OrmRepository<PerformanceEvalConfigDTO>(orm, 'PerformanceEvalConfig')

      const log = logger.child('empleados')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const leaveConfig = new LeaveConfigUseCase(leaveTypeRepo, allocationRepo, holidayRepo, leaveRepo, log)
      const appraisalConfig = new AppraisalConfigUseCase(templateRepo, log)
      const hrCatalog = new HrCatalogUseCase(jobRepo, contractTypeRepo, locationRepo, log)
      const evalConfig = new EvalConfigUseCase(evalConfigRepo, log)
      const autoEval = new AutoEvaluationUseCase(evalConfig, reviewRepo, profileRepo, log)
      const service = new EmpleadosService(
        departmentRepo, profileRepo, contractRepo,
        documentRepo, leaveRepo, reviewRepo,
        log, cache, userRepo, auth,
        leaveConfig,
      )
      const dashboard = new DashboardUseCase(profileRepo, contractRepo, documentRepo, leaveRepo, reviewRepo, departmentRepo, log, userRepo)
      service.attachDashboard(dashboard)   // permite inyectar el puerto de asistencia (#198) por connector
      service.attachAutoEvaluation(autoEval) // motor de evaluación (#321): los connectors le inyectan los puertos hk/attendance
      const dossier = new DossierUseCase(service) // expediente integral (#323): reusa los reads públicos del service
      const controller = new EmpleadosController(service, log, dashboard, opts.storage, leaveConfig, appraisalConfig, hrCatalog, evalConfig, autoEval, dossier)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // ─── Departments ──────────────────────────────────
      router.post('/api/departments', guard('users', 'create'), (req) => controller.createDepartment(req))
      router.get('/api/departments', guard('users', 'view'), (req) => controller.listDepartments(req))
      router.get('/api/departments/:id', guard('users', 'view'), (req) => controller.getDepartment(req))
      router.put('/api/departments/:id', guard('users', 'edit'), (req) => controller.updateDepartment(req))
      router.delete('/api/departments/:id', guard('users', 'delete'), (req) => controller.deleteDepartment(req))

      // ─── Employee Profiles ────────────────────────────
      router.post('/api/employee-profiles', guard('users', 'create'), (req) => controller.createProfile(req))
      router.get('/api/employee-profiles', guard('users', 'view'), (req) => controller.listProfiles(req))
      // Autoservicio: la app del personal necesita su `profile.id` para pedir sus tareas, y
      // `users:view` le daría los contratos, salarios y licencias de todo el hotel.
      // Va ANTES de `/:id`: el router resuelve por orden de registro y `me` se comería como un id.
      router.get('/api/employee-profiles/me', [auth.authenticate(...STAFF_ROLES)], (req) => controller.myProfile(req))
      // Expediente integral consolidado (#323). Va ANTES de `/:id` — el router resuelve por orden de
      // registro y `/:id` NO debe comerse el segmento `dossier`.
      router.get('/api/employee-profiles/:id/dossier', guard('users', 'view'), (req) => controller.getDossier(req))
      router.get('/api/employee-profiles/:id', guard('users', 'view'), (req) => controller.getProfile(req))
      router.put('/api/employee-profiles/:id', guard('users', 'edit'), (req) => controller.updateProfile(req))
      router.delete('/api/employee-profiles/:id', guard('users', 'delete'), (req) => controller.deactivateProfile(req))
      router.post('/api/employee-profiles/:id/reactivate', guard('users', 'edit'), (req) => controller.reactivateProfile(req))

      // ─── Contracts ────────────────────────────────────
      router.post('/api/employee-contracts', guard('users', 'create'), (req) => controller.createContract(req))
      router.get('/api/employee-contracts', guard('users', 'view'), (req) => controller.listContracts(req))
      router.get('/api/employee-contracts/:id', guard('users', 'view'), (req) => controller.getContract(req))
      router.post('/api/employee-contracts/:id/terminate', guard('users', 'edit'), (req) => controller.terminateContract(req))

      // ─── Documents ────────────────────────────────────
      router.post('/api/employee-documents', [...guard('users', 'create'), bodyLimit(DOCUMENT_UPLOAD_LIMIT)], (req) => controller.createDocument(req))
      router.get('/api/employee-documents', guard('users', 'view'), (req) => controller.listDocuments(req))
      router.get('/api/employee-documents/expiring', guard('users', 'view'), (req) => controller.getExpiringDocuments(req))
      router.get('/api/employee-documents/:id', guard('users', 'view'), (req) => controller.getDocument(req))
      router.delete('/api/employee-documents/:id', guard('users', 'delete'), (req) => controller.deleteDocument(req))

      // ─── Leave Requests ───────────────────────────────
      router.post('/api/leave-requests', guard('users', 'create'), (req) => controller.createLeaveRequest(req))
      router.get('/api/leave-requests', guard('users', 'view'), (req) => controller.listLeaveRequests(req))
      router.get('/api/leave-requests/:id', guard('users', 'view'), (req) => controller.getLeaveRequest(req))
      router.post('/api/leave-requests/:id/approve', guard('users', 'edit'), (req) => controller.approveLeaveRequest(req))
      router.post('/api/leave-requests/:id/reject', guard('users', 'edit'), (req) => controller.rejectLeaveRequest(req))

      // ─── Time Off: tipos, asignaciones, festivos, saldo, calendario ──
      router.get('/api/leave-types', guard('users', 'view'), (req) => controller.listLeaveTypes(req))
      router.post('/api/leave-types', guard('users', 'create'), (req) => controller.createLeaveType(req))
      router.put('/api/leave-types/:id', guard('users', 'edit'), (req) => controller.updateLeaveType(req))
      router.delete('/api/leave-types/:id', guard('users', 'delete'), (req) => controller.deleteLeaveType(req))

      router.get('/api/leave-allocations', guard('users', 'view'), (req) => controller.listLeaveAllocations(req))
      router.post('/api/leave-allocations', guard('users', 'create'), (req) => controller.createLeaveAllocation(req))
      router.delete('/api/leave-allocations/:id', guard('users', 'delete'), (req) => controller.deleteLeaveAllocation(req))

      router.get('/api/public-holidays', guard('users', 'view'), (req) => controller.listPublicHolidays(req))
      router.post('/api/public-holidays', guard('users', 'create'), (req) => controller.createPublicHoliday(req))
      router.delete('/api/public-holidays/:id', guard('users', 'delete'), (req) => controller.deletePublicHoliday(req))

      router.get('/api/leave-balance/:employeeId', guard('users', 'view'), (req) => controller.getLeaveBalance(req))
      router.get('/api/leave-calendar', guard('users', 'view'), (req) => controller.getLeaveCalendar(req))

      // ─── Performance Reviews ──────────────────────────
      router.post('/api/performance-reviews', guard('users', 'create'), (req) => controller.createReview(req))
      router.get('/api/performance-reviews', guard('users', 'view'), (req) => controller.listReviews(req))
      router.get('/api/performance-reviews/:id', guard('users', 'view'), (req) => controller.getReview(req))
      router.put('/api/performance-reviews/:id', guard('users', 'edit'), (req) => controller.updateReview(req))
      router.post('/api/performance-reviews/:id/complete', guard('users', 'edit'), (req) => controller.completeReview(req))

      // ─── Appraisal Templates (formularios de evaluación) ──
      router.get('/api/appraisal-templates', guard('users', 'view'), (req) => controller.listAppraisalTemplates(req))
      router.post('/api/appraisal-templates', guard('users', 'create'), (req) => controller.createAppraisalTemplate(req))
      router.put('/api/appraisal-templates/:id', guard('users', 'edit'), (req) => controller.updateAppraisalTemplate(req))
      router.delete('/api/appraisal-templates/:id', guard('users', 'delete'), (req) => controller.deleteAppraisalTemplate(req))

      // ─── Evaluación automática de desempeño (#321) + su config (#322) ──
      router.get('/api/performance-eval/config', guard('users', 'view'), (req) => controller.getEvalConfig(req))
      router.put('/api/performance-eval/config', guard('users', 'edit'), (req) => controller.updateEvalConfig(req))
      router.post('/api/performance-eval/run', guard('users', 'edit'), (req) => controller.runAutoEvaluation(req))
      router.get('/api/performance-eval/results', guard('users', 'view'), (req) => controller.listEvalResults(req))

      // ─── Catálogos: puestos, tipos de contrato, ubicaciones ──
      router.get('/api/job-positions', guard('users', 'view'), (req) => controller.listJobPositions(req))
      router.post('/api/job-positions', guard('users', 'create'), (req) => controller.createJobPosition(req))
      router.put('/api/job-positions/:id', guard('users', 'edit'), (req) => controller.updateJobPosition(req))
      router.delete('/api/job-positions/:id', guard('users', 'delete'), (req) => controller.deleteJobPosition(req))

      router.get('/api/contract-types', guard('users', 'view'), (req) => controller.listContractTypes(req))
      router.post('/api/contract-types', guard('users', 'create'), (req) => controller.createContractType(req))
      router.delete('/api/contract-types/:id', guard('users', 'delete'), (req) => controller.deleteContractType(req))

      router.get('/api/work-locations', guard('users', 'view'), (req) => controller.listWorkLocations(req))
      router.post('/api/work-locations', guard('users', 'create'), (req) => controller.createWorkLocation(req))
      router.delete('/api/work-locations/:id', guard('users', 'delete'), (req) => controller.deleteWorkLocation(req))

      // ─── Org Chart ────────────────────────────────────
      router.get('/api/org-chart', guard('users', 'view'), (req) => controller.getOrgChart(req))

      // ─── Dashboard RRHH (resumen consolidado de talento) ──
      router.get('/api/hr-dashboard', guard('users', 'view'), (req) => controller.getDashboard(req))

      log.info('Módulo empleados listo — 9 tablas, Time Off Odoo (tipos/asignaciones/festivos/saldo/calendario)')
      return service
    },
  })
}
