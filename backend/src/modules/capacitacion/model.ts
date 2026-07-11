// capacitacion/model.ts — Cursos/certificaciones/inducciones y las inscripciones de empleados.
import type { ModelDefinition, ORM } from 'arckode-framework'

const TrainingCourseModel: ModelDefinition = {
  table: 'training_courses',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    type: { type: 'string', required: true, default: 'course' }, // course | certification | onboarding
    description: { type: 'string' },
    materialUrl: { type: 'string' }, // link al contenido (video/PDF/plataforma) que va en el correo
    durationHours: { type: 'number' },
    validityMonths: { type: 'number' }, // vigencia de la certificación (null = no vence)
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

const TrainingEnrollmentModel: ModelDefinition = {
  table: 'training_enrollments',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    courseId: { type: 'string', required: true, indexed: true },
    employeeId: { type: 'string', required: true, indexed: true },
    status: { type: 'string', required: true, default: 'enrolled' }, // enrolled | completed
    // Token del link de confirmación que se le manda al empleado por correo (para autoconfirmar).
    confirmToken: { type: 'string', indexed: true },
    enrolledAt: { type: 'string' },
    completedAt: { type: 'string' },
    expiresAt: { type: 'string' },
    score: { type: 'number' },
    notes: { type: 'string' },
  },
  timestamps: true,
}

export function registerCapacitacionModels(orm: ORM): void {
  orm.define('TrainingCourse', TrainingCourseModel)
  orm.define('TrainingEnrollment', TrainingEnrollmentModel)
}
