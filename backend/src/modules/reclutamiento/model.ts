// reclutamiento/model.ts — Postulantes y pipeline de selección (Odoo hr_recruitment).
//
// Un postulante avanza por etapas fijas: new → screening → interview → offer → hired/rejected.
// `jobPositionId` referencia el puesto (owned by empleados) por valor — sin FK, solo el id.

import type { ModelDefinition, ORM } from 'arckode-framework'

export const JobApplicantModel: ModelDefinition = {
  table: 'job_applicants',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    jobPositionId: { type: 'string', indexed: true },
    name: { type: 'string', required: true },
    email: { type: 'string' },
    phone: { type: 'string' },
    source: { type: 'string' },                 // web, referral, agency…
    stage: { type: 'string', default: 'new' },  // new · screening · interview · offer · hired · rejected
    rating: { type: 'number', default: 0 },     // 0-5 estrellas
    cvUrl: { type: 'string' },
    notes: { type: 'string' },
    rejectReason: { type: 'string' },
    hiredEmployeeId: { type: 'string' },         // profile.id creado al contratar
    active: { type: 'boolean', default: 1 },
  },
  timestamps: true,
}

export function registerReclutamientoModels(orm: ORM): void {
  orm.define('JobApplicant', JobApplicantModel)
}
