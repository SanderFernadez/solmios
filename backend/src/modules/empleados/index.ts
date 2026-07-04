// empleados/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerEmpleadosModels } from './model'
import { EmpleadosService } from './service'
import { EmpleadosController } from './controller'
import type {
  DepartmentDTO, EmployeeProfileDTO, ContractDTO,
  DocumentDTO, LeaveRequestDTO, PerformanceReviewDTO,
} from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { EmpleadosService }
export type {
  DepartmentDTO, EmployeeProfileDTO, ContractDTO,
  DocumentDTO, LeaveRequestDTO, PerformanceReviewDTO,
  CreateDepartmentDTO, CreateEmployeeProfileDTO, CreateContractDTO,
  CreateDocumentDTO, CreateLeaveRequestDTO, CreatePerformanceReviewDTO,
  EmpleadosQuery, EmpleadosPaginated, DocumentExpiryAlert,
} from './types'
export type { EmpleadosSockets } from './sockets'

export function EmpleadosModule() {
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
        'createProfile', 'listProfiles', 'getProfile', 'updateProfile', 'deactivateProfile',
        'createContract', 'listContracts', 'getContract', 'terminateContract',
        'createDocument', 'listDocuments', 'getDocument', 'deleteDocument',
        'createLeaveRequest', 'listLeaveRequests', 'approveLeaveRequest', 'rejectLeaveRequest',
        'createReview', 'listReviews', 'getReview', 'completeReview',
        'getExpiringDocuments', 'getOrgChart',
      ],
      events: [
        'onEmployeeCreated', 'onEmployeeDeactivated',
        'onDocumentExpiring', 'onLeaveRequestPending',
      ],
      tables: ['departments', 'employee_profiles', 'employee_contracts', 'employee_documents', 'leave_requests', 'performance_reviews'],
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

      const log = logger.child('empleados')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new EmpleadosService(
        departmentRepo, profileRepo, contractRepo,
        documentRepo, leaveRepo, reviewRepo,
        log, cache, userRepo,
      )
      const controller = new EmpleadosController(service, log)

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
      router.get('/api/employee-profiles/:id', guard('users', 'view'), (req) => controller.getProfile(req))
      router.put('/api/employee-profiles/:id', guard('users', 'edit'), (req) => controller.updateProfile(req))
      router.delete('/api/employee-profiles/:id', guard('users', 'delete'), (req) => controller.deactivateProfile(req))

      // ─── Contracts ────────────────────────────────────
      router.post('/api/employee-contracts', guard('users', 'create'), (req) => controller.createContract(req))
      router.get('/api/employee-contracts', guard('users', 'view'), (req) => controller.listContracts(req))
      router.get('/api/employee-contracts/:id', guard('users', 'view'), (req) => controller.getContract(req))
      router.post('/api/employee-contracts/:id/terminate', guard('users', 'edit'), (req) => controller.terminateContract(req))

      // ─── Documents ────────────────────────────────────
      router.post('/api/employee-documents', guard('users', 'create'), (req) => controller.createDocument(req))
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

      // ─── Performance Reviews ──────────────────────────
      router.post('/api/performance-reviews', guard('users', 'create'), (req) => controller.createReview(req))
      router.get('/api/performance-reviews', guard('users', 'view'), (req) => controller.listReviews(req))
      router.get('/api/performance-reviews/:id', guard('users', 'view'), (req) => controller.getReview(req))
      router.post('/api/performance-reviews/:id/complete', guard('users', 'edit'), (req) => controller.completeReview(req))

      // ─── Org Chart ────────────────────────────────────
      router.get('/api/org-chart', guard('users', 'view'), (req) => controller.getOrgChart(req))

      log.info('Módulo empleados listo — 6 tablas, 27 endpoints')
      return service
    },
  })
}
