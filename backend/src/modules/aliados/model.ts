// aliados/model.ts — Programa "Aliados": evolución del programa de Referidos
// (ver modules/referrals/) para hoteles que superaron 5 referidos VALIDADOS. En vez de
// meses gratis de su propia suscripción, el Aliado gana % en DINERO por cada hotel que
// refiere y termina validando. Dos niveles: 'aliado' (escala por tramos, editable desde
// admin) y 'aliado_certificado' (20% fijo desde el primer hotel, pasó por evaluación).
import type { ORM, ModelDefinition } from 'arckode-framework'

/** 1 fila por hotel que es Aliado o Aliado Certificado. Un hotel es partner o no lo es
 *  (unicidad lógica por hotelId — el service la aplica, el ORM no tiene UNIQUE compuesto). */
export const PartnersModel: ModelDefinition = {
  table: 'partners',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    /** aliado | aliado_certificado */
    type: { type: 'string', required: true },
    /** monthly | one_time. Para 'aliado_certificado' SIEMPRE 'monthly' — el service rechaza cambiarlo. */
    payoutMode: { type: 'string', required: true, default: 'monthly' },
    /** active | inactive */
    status: { type: 'string', required: true, default: 'active' },
    becamePartnerAt: { type: 'string', required: true },
    /** Null si type='aliado'. Cuándo se aprobó la certificación. */
    certifiedAt: { type: 'string' },
  },
}

/** 1 fila por comisión ganada sobre un hotel referido concreto — se genera en el mismo
 *  momento en que el Referral (ver referrals/model.ts) pasa a 'validated'. */
export const PartnerCommissionsModel: ModelDefinition = {
  table: 'partner_commissions',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    partnerId: { type: 'string', required: true, indexed: true },
    /** FK lógica a `referrals.id` (referrals/model.ts) — mismo criterio que el resto del
     *  sistema: multi-tenant/relaciones por columna, sin FK física entre módulos. */
    referralId: { type: 'string', required: true, indexed: true },
    referredHotelId: { type: 'string', required: true, indexed: true },
    /** Snapshot del % vigente AL MOMENTO de validar — no se recalcula si cambian los tramos después. */
    percent: { type: 'number', required: true },
    /** Snapshot de lo que el partner tenía elegido al momento de validar. */
    payoutMode: { type: 'string', required: true },
    /** pending_payout (one_time recién validado, esperando liberación) | active (monthly en
     *  curso) | paid_out (un super_admin la marcó pagada) | cancelled (clawback: el referido
     *  se dio de baja antes de liberar un one_time) */
    status: { type: 'string', required: true, default: 'pending_payout' },
    /** Solo aplica a one_time: 1 mes de la suscripción del hotel REFERIDO, calculado al liberar. */
    payoutAmount: { type: 'number' },
    /** Mismo momento en que el Referral pasa a 'validated'. */
    validatedAt: { type: 'string', required: true },
    /** Null hasta que un super_admin la marca pagada manualmente (no hay integración de pago real). */
    paidAt: { type: 'string' },
  },
}

/** Tramos escalonados de comisión del Aliado normal — mismo patrón que
 *  referrals/model.ts:ReferralTiersModel. Editable desde admin, cero hardcode. */
export const PartnerCommissionTiersModel: ModelDefinition = {
  table: 'partner_commission_tiers',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    fromCount: { type: 'number', required: true },
    percent: { type: 'number', required: true },
    sortOrder: { type: 'number', required: true, default: 0 },
  },
}

/** Solicitud de un hotel para convertirse en Aliado Certificado: cuestionario inicial +
 *  evaluación posterior a los tutoriales. */
export const PartnerCertificationRequestsModel: ModelDefinition = {
  table: 'partner_certification_requests',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    /** pending | approved | rejected */
    status: { type: 'string', required: true, default: 'pending' },
    /** Respuestas del cuestionario inicial (experiencia web, programación, presencia digital). */
    answers: { type: 'json', default: {} },
    /** Null hasta rendir la evaluación posterior a los tutoriales. */
    examScore: { type: 'number' },
    reviewedBy: { type: 'string' },
    reviewedAt: { type: 'string' },
  },
}

export function registerAliadosModels(orm: ORM): void {
  orm.define('Partners', PartnersModel)
  orm.define('PartnerCommissions', PartnerCommissionsModel)
  orm.define('PartnerCommissionTiers', PartnerCommissionTiersModel)
  orm.define('PartnerCertificationRequests', PartnerCertificationRequestsModel)
}
