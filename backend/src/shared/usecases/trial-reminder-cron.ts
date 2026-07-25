// shared/usecases/trial-reminder-cron.ts — Aviso de trial por vencer / vencido (SaaS).
//
// Molde: night-audit-cron.ts. Corre sobre TODAS las suscripciones `trialing`, y por cada una
// que esté a <=2 días de vencer (o ya vencida) manda el correo correspondiente vía
// `platform-emails.sendEvent()`. Dedup con `trialReminderSentAt`/`trialExpiredEmailSentAt` en
// `subscriptions`: sin esas marcas, el cron (cada 6h) reenviaría el mismo correo en cada tick.
//
// `now` inyectable (parámetro con default `new Date()`) para que el test pueda fijar la fecha sin
// pisar el reloj global — mismo criterio que `SignupUseCase.signup(input, now)`.
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function createTrialReminderCron(
  orm: any,
  resolveModule: (name: string) => any,
  logger: any,
): (now?: Date) => Promise<{ ending: number; expired: number }> {
  return async (now: Date = new Date()): Promise<{ ending: number; expired: number }> => {
    try {
      const platformEmails = resolveModule('platform-emails')
      if (!platformEmails || typeof platformEmails.sendEvent !== 'function') {
        logger.warn('trial-reminder-cron: módulo platform-emails no disponible')
        return { ending: 0, expired: 0 }
      }

      const subs = (await orm.findMany('Subscriptions', { status: 'trialing' })) as any[]
      let ending = 0
      let expired = 0

      for (const sub of subs) {
        if (!sub.trialEndsAt) continue
        const trialEnd = new Date(sub.trialEndsAt)
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / MS_PER_DAY)

        // @ignore IDOR_RISK — hotelId sale de la propia Subscription (dato del sistema, no de un
        // request de cliente): el cron recorre TODAS las suscripciones trialing.
        const hotel = await orm.findById('Hotels', sub.hotelId)
        if (!hotel?.email) continue

        const link = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/panel/suscripcion`

        if (daysLeft <= 2 && daysLeft >= 0 && !sub.trialReminderSentAt) {
          await platformEmails.sendEvent('trial_ending', hotel.email, hotel.id, {
            hotel_name: hotel.name, days_left: String(daysLeft), link,
          })
          await orm.update('Subscriptions', sub.id, { trialReminderSentAt: now.toISOString() })
          ending++
        } else if (daysLeft < 0 && !sub.trialExpiredEmailSentAt) {
          await platformEmails.sendEvent('trial_expired', hotel.email, hotel.id, {
            hotel_name: hotel.name, link,
          })
          await orm.update('Subscriptions', sub.id, { trialExpiredEmailSentAt: now.toISOString() })
          expired++
        }
      }

      logger.info('trial-reminder-cron completado', { ending, expired })
      return { ending, expired }
    } catch (e: any) {
      logger.warn('trial-reminder-cron falló', { error: e.message })
      return { ending: 0, expired: 0 }
    }
  }
}
