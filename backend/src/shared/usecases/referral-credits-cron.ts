// shared/usecases/referral-credits-cron.ts — Motor de validación y liberación de créditos
// del programa de Referidos (PLAN-REFERIDOS.md §5). Hermano de subscription-suspension-cron.ts,
// mismo molde (factory con `now` inyectable, try/catch que nunca tira, orm crudo porque recorre
// TODAS las filas de un status, no hay req.user).
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MONTH = 30 * MS_PER_DAY // meses "de 30 días" a propósito: simple, determinístico, sin líos de calendario

interface ReferralProgramLike {
  enabled: boolean
  activeMonthsRequired: number
  requirePaidStatus: boolean
  maxAccumulatedMonths: number | null
  clawbackWindowDays: number
}

const DEFAULT_PROGRAM: ReferralProgramLike = {
  enabled: false, activeMonthsRequired: 3, requirePaidStatus: true, maxAccumulatedMonths: 12, clawbackWindowDays: 30,
}

async function readProgram(orm: any): Promise<ReferralProgramLike> {
  const row = (await orm.findMany('Configuration', { hotelId: 'platform', key: 'referral_program' }))[0]
  if (!row) return DEFAULT_PROGRAM
  const v = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {})
  return { ...DEFAULT_PROGRAM, ...v }
}

/** Mismo criterio de tramos que ReferralTiersUseCase.tierMonths — reimplementado acá (no se
 *  puede importar de `modules/referrals/` desde `shared/`: mismo motivo que separa admin de
 *  subscriptions, este cron vive fuera de cualquier módulo). Tramo con mayor fromCount <= count. */
function tierMonths(count: number, tiers: any[]): number {
  const applicable = tiers.filter((t) => t.fromCount <= count).sort((a, b) => b.fromCount - a.fromCount)
  return Number(applicable[0]?.monthsGranted ?? 0)
}

export interface ReferralCreditsCronResult {
  toActive: number
  validated: number
  released: number
  churned: number
  revoked: number
}

export function createReferralCreditsCron(
  orm: any,
  resolveModule: (name: string) => any,
  logger: any,
): (now?: Date) => Promise<ReferralCreditsCronResult> {
  return async (now: Date = new Date()): Promise<ReferralCreditsCronResult> => {
    const zero: ReferralCreditsCronResult = { toActive: 0, validated: 0, released: 0, churned: 0, revoked: 0 }
    try {
      const program = await readProgram(orm)
      if (!program.enabled) return zero

      let toActive = 0
      let validated = 0
      let released = 0
      let churned = 0
      let revoked = 0

      // 1) trial → active: el referido ya está pagando de verdad.
      const trialReferrals = (await orm.findMany('Referrals', { status: 'trial' })) as any[]
      for (const r of trialReferrals) {
        const sub = (await orm.findMany('Subscriptions', { hotelId: r.referredHotelId }))[0] as any
        const paying = sub?.status === 'active' || (!program.requirePaidStatus && sub?.status === 'past_due')
        if (!paying) continue
        await orm.update('Referrals', r.id, { status: 'active', activeSince: now.toISOString() })
        toActive++
      }

      // 2) active → validated (cumplió los meses) o churned (el referido se fue antes de validar)
      const activeReferrals = (await orm.findMany('Referrals', { status: 'active' })) as any[]
      const tiers = (await orm.findMany('ReferralTiers', {})) as any[]
      for (const r of activeReferrals) {
        const sub = (await orm.findMany('Subscriptions', { hotelId: r.referredHotelId }))[0] as any
        const stillPaying = sub && (sub.status === 'active' || sub.status === 'past_due')
        if (!stillPaying) {
          await orm.update('Referrals', r.id, { status: 'churned' })
          churned++
          continue
        }
        if (!r.activeSince) continue
        const monthsElapsed = Math.floor((now.getTime() - new Date(r.activeSince).getTime()) / MS_PER_MONTH)
        if (monthsElapsed < program.activeMonthsRequired) continue

        await orm.update('Referrals', r.id, { status: 'validated', validatedAt: now.toISOString() })
        validated++

        const validatedCount = ((await orm.findMany('Referrals', { referrerHotelId: r.referrerHotelId, status: 'validated' })) as any[]).length
        const monthsGranted = tierMonths(validatedCount, tiers)
        if (monthsGranted <= 0) continue // sin tramos configurados para este conteo: no se inventa un crédito

        const referrerSub = (await orm.findMany('Subscriptions', { hotelId: r.referrerHotelId }))[0] as any
        await orm.create('ReferralCredits', {
          referralId: r.id, referrerHotelId: r.referrerHotelId, monthsGranted, status: 'pending',
          basePlanId: referrerSub?.planId ?? null, baseAmount: null, earnedAt: now.toISOString(), releasedAt: null,
        })
      }

      // 3) créditos 'pending' → aplicar cupón real en Stripe (F6 del programa)
      const pendingCredits = (await orm.findMany('ReferralCredits', { status: 'pending' })) as any[]
      const subscriptionsModule = resolveModule('subscriptions')
      for (const credit of pendingCredits) {
        if (program.maxAccumulatedMonths != null) {
          const alreadyReleased = ((await orm.findMany('ReferralCredits', { referrerHotelId: credit.referrerHotelId, status: 'released' })) as any[])
            .reduce((sum, c) => sum + Number(c.monthsGranted || 0), 0)
          if (alreadyReleased + credit.monthsGranted > program.maxAccumulatedMonths) {
            continue // tope alcanzado: el crédito queda 'pending' (auditable), no se aplica ni se pierde
          }
        }
        if (!subscriptionsModule?.applyStripeDiscount) continue
        const result = await subscriptionsModule.applyStripeDiscount(
          credit.referrerHotelId, 100, credit.monthsGranted,
          { type: 'referral_credit', reason: 'Crédito por programa de referidos' },
        )
        if (result?.applied) {
          await orm.update('ReferralCredits', credit.id, { status: 'released', releasedAt: now.toISOString() })
          released++
        }
        // si no se aplicó (el referidor todavía no tiene stripeSubscriptionId), sigue 'pending' y se reintenta el próximo tick
      }

      // 4) clawback: el referido se dio de baja/quedó suspendido dentro de la ventana post-validación
      const validatedReferrals = (await orm.findMany('Referrals', { status: 'validated' })) as any[]
      for (const r of validatedReferrals) {
        if (!r.validatedAt) continue
        const sub = (await orm.findMany('Subscriptions', { hotelId: r.referredHotelId }))[0] as any
        const referredChurned = !sub || sub.status === 'canceled' || sub.status === 'suspended'
        if (!referredChurned) continue
        const daysSinceValidated = (now.getTime() - new Date(r.validatedAt).getTime()) / MS_PER_DAY
        if (daysSinceValidated > program.clawbackWindowDays) continue

        const credits = (await orm.findMany('ReferralCredits', { referralId: r.id })) as any[]
        for (const c of credits) {
          if (c.status === 'revoked') continue
          await orm.update('ReferralCredits', c.id, { status: 'revoked' })
          revoked++
        }
      }

      logger.info('referral-credits-cron completado', { toActive, validated, released, churned, revoked })
      return { toActive, validated, released, churned, revoked }
    } catch (e: any) {
      logger.warn('referral-credits-cron falló', { error: e.message })
      return zero
    }
  }
}
