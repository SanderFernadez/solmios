// reclutamiento/index.ts — PUERTA PÚBLICA
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerReclutamientoModels } from './model'
import { ReclutamientoService } from './service'
import { ReclutamientoController } from './controller'
import type { ApplicantDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { ReclutamientoService }
export type {
  ApplicantDTO, CreateApplicantDTO, UpdateApplicantDTO, PipelineSummary,
  ReclutamientoDTO, CreateReclutamientoDTO, UpdateReclutamientoDTO, ReclutamientoQuery, ReclutamientoPaginated,
} from './types'
export type { ReclutamientoSockets } from './sockets'
export { ReclutamientoValidator, CreateReclutamientoSchema, UpdateReclutamientoSchema } from './validators/schema'

export function ReclutamientoModule() {
  return createModule({
    name: 'reclutamiento',
    version: '1.0.0',
    description: 'Reclutamiento: postulantes y pipeline de selección (Odoo hr_recruitment)',

    contract: {
      name: 'reclutamiento',
      version: '1.0.0',
      description: 'Postulantes, pipeline por etapas, contratación',
      actions: ['list', 'pipeline', 'getById', 'create', 'update', 'moveStage', 'reject', 'hire', 'delete'],
      events: ['onApplicantCreated', 'onApplicantHired', 'onApplicantRejected'],
      tables: ['job_applicants'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('reclutamiento: auth dependency required')
      registerReclutamientoModels(orm)

      const repo = new OrmRepository<ApplicantDTO>(orm, 'JobApplicant')
      const log = logger.child('reclutamiento')
      const service = new ReclutamientoService(repo, log, cache, auth)
      const controller = new ReclutamientoController(service, log)

      // Reclutamiento es tarea de RRHH → se protege con el permiso `users` (mismo que empleados).
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/applicants', guard('users', 'view'), (req) => controller.index(req))
      router.get('/api/applicants/pipeline', guard('users', 'view'), (req) => controller.pipeline(req))
      router.get('/api/applicants/:id', guard('users', 'view'), (req) => controller.show(req))
      router.post('/api/applicants', guard('users', 'create'), (req) => controller.store(req))
      router.put('/api/applicants/:id', guard('users', 'edit'), (req) => controller.update(req))
      router.post('/api/applicants/:id/stage', guard('users', 'edit'), (req) => controller.moveStage(req))
      router.post('/api/applicants/:id/reject', guard('users', 'edit'), (req) => controller.reject(req))
      router.post('/api/applicants/:id/hire', guard('users', 'edit'), (req) => controller.hire(req))
      router.delete('/api/applicants/:id', guard('users', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo reclutamiento listo — pipeline de selección')
      return service
    },
  })
}
