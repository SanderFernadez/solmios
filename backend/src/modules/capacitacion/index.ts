// capacitacion/index.ts — PUERTA PÚBLICA (cursos, certificaciones, inducciones + inscripciones).
import { createModule, OrmRepository } from 'arckode-framework'
import { registerCapacitacionModels } from './model'
import { CapacitacionService } from './service'
import { CapacitacionController } from './controller'
import type { CourseDTO, EnrollmentDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { CapacitacionService }
export type { CourseDTO, CreateCourseDTO, EnrollmentDTO, CreateEnrollmentDTO, CapacitacionDTO, CapacitacionQuery } from './types'
export type { CapacitacionSockets } from './sockets'
export { CapacitacionValidator, CreateCapacitacionSchema, UpdateCapacitacionSchema } from './validators/schema'

export function CapacitacionModule() {
  return createModule({
    name: 'capacitacion',
    version: '1.0.0',
    description: 'Capacitación: cursos, certificaciones e inducciones + inscripciones de empleados',

    contract: {
      name: 'capacitacion',
      version: '1.0.0',
      description: 'Cursos y su seguimiento por empleado',
      actions: ['listCourses', 'createCourse', 'updateCourse', 'deleteCourse', 'listEnrollments', 'enroll', 'complete', 'deleteEnrollment'],
      events: ['onCapacitacionCreated', 'onCapacitacionUpdated', 'onCapacitacionDeleted'],
      tables: ['training_courses', 'training_enrollments'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Multi-tenant por hotelId'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('capacitacion: auth dependency required')
      registerCapacitacionModels(orm)

      const courseRepo = new OrmRepository<CourseDTO>(orm, 'TrainingCourse')
      const enrollRepo = new OrmRepository<EnrollmentDTO>(orm, 'TrainingEnrollment')
      const profileRepo = new OrmRepository<{ id: string; hotelId: string }>(orm, 'EmployeeProfile')
      const log = logger.child('capacitacion')
      const service = new CapacitacionService(courseRepo, enrollRepo, log, cache, profileRepo)
      const controller = new CapacitacionController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // Cursos
      router.get('/api/training/courses', guard('users', 'view'), (req) => controller.listCourses(req))
      router.post('/api/training/courses', guard('users', 'create'), (req) => controller.createCourse(req))
      router.put('/api/training/courses/:id', guard('users', 'edit'), (req) => controller.updateCourse(req))
      router.delete('/api/training/courses/:id', guard('users', 'delete'), (req) => controller.deleteCourse(req))

      // Inscripciones
      router.get('/api/training/enrollments', guard('users', 'view'), (req) => controller.listEnrollments(req))
      router.post('/api/training/enrollments', guard('users', 'edit'), (req) => controller.enroll(req))
      router.post('/api/training/enrollments/:id/complete', guard('users', 'edit'), (req) => controller.completeEnrollment(req))
      router.delete('/api/training/enrollments/:id', guard('users', 'delete'), (req) => controller.deleteEnrollment(req))

      // Confirmación pública desde el link del correo (sin login: el token es la llave).
      // GET muestra la página con el botón; POST marca completado.
      router.get('/api/training/confirm/:token', (req) => controller.confirmPage(req))
      router.post('/api/training/confirm/:token', (req) => controller.confirmSubmit(req))

      log.info('Módulo capacitacion listo — 2 tablas, 8 endpoints')
      return service
    },
  })
}
