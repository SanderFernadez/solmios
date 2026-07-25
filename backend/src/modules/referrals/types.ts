// referrals/types.ts — Contratos de la API (distinto de model.ts, que es la BD).

export interface ReferralProgram {
  enabled: boolean
  programName: string
  /** Meses que el referido debe estar pagando (status='active') para validar. */
  activeMonthsRequired: number
  /** El referido debe tener su Subscription en 'active' (no alcanza con 'trialing'). Fijo en true en esta pasada — ver PLAN-REFERIDOS.md §"Alcance". */
  requirePaidStatus: boolean
  /** % de descuento del mes de bienvenida del referido — hoy informativo (ver limitación en PLAN-REFERIDOS.md, no se aplica automáticamente en el checkout todavía). */
  referredRewardValue: number
  /** Máximo de meses de crédito acumulables (pending+released) por referidor. Null = sin tope. */
  maxAccumulatedMonths: number | null
  /** Meses sin usar antes de expirar un crédito 'pending'. Null = no expira. (Hoy los créditos se intentan aplicar apenas se generan — ver cron — así que en la práctica no llegan a esperar.) */
  creditExpiresMonths: number | null
  /** Días post-validación: si el referido se da de baja en ese lapso, se revoca el crédito. */
  clawbackWindowDays: number
}

export interface ReferralTierDTO {
  id: string
  fromCount: number
  monthsGranted: number
  sortOrder: number
}

export type ReferralStatus = 'trial' | 'active' | 'validated' | 'churned'
export type ReferralCreditStatus = 'pending' | 'released' | 'revoked'
/** Estado del descuento de bienvenida al referido (1er mes gratis). Ver `ReferralsModel.welcomeRewardStatus`. */
export type WelcomeRewardStatus = 'pending' | 'applied' | 'skipped'

export interface ReferralDTO {
  id: string
  referrerHotelId: string
  referredHotelId: string
  code: string
  status: ReferralStatus
  activeSince: string | null
  validatedAt: string | null
  /** Opcional: referrals creados antes de la feature pueden no tenerlo (backfillean a 'pending' en DB). */
  welcomeRewardStatus?: WelcomeRewardStatus
  createdAt?: string
}

export interface ReferralCreditDTO {
  id: string
  referralId: string
  referrerHotelId: string
  monthsGranted: number
  status: ReferralCreditStatus
  basePlanId: string | null
  baseAmount: number | null
  earnedAt: string
  releasedAt: string | null
}

export interface MyReferralsDTO {
  code: string
  shareLink: string
  referrals: Array<ReferralDTO & { referredHotelName: string }>
  credits: ReferralCreditDTO[]
  totalMonthsEarned: number
  nextTierMonths: number | null
  referralsUntilNextTier: number | null
}

export interface ReferralMetricsDTO {
  totalReferrals: number
  validatedCount: number
  conversionPct: number
  totalMonthsGranted: number
  topReferrers: Array<{ hotelId: string; hotelName: string; validatedCount: number }>
}
