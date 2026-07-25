// shared/usecases/subscription-suspension-cron.ts — Recordatorio → gracia → suspensión (SaaS).
//
// Molde: trial-reminder-cron.ts (hermano, mismo patrón exacto). Ese cron cubre solo
// `trialing`; este cubre `active`/`past_due`/`suspended` — el resto del ciclo de cobro
// una vez que el hotel ya empezó a pagar. Reactivación NO vive acá: es el efecto del pago
// real (handle-stripe-event.ts, caso invoice.paid), nunca un cron.
//
// `now` inyectable (default `new Date()`) para tests, mismo criterio que trial-reminder-cron.
//
// Orden de los 3 pasos importa: cada uno vuelve a leer de `orm` (no reusa el array del paso
// anterior), así que un sub que pasó de active→past_due en el paso 2 puede ya evaluarse para
// suspensión en el paso 3 del MISMO tick si su gracia ya está vencida (ej. gracePeriodDays=0).
const MS_PER_DAY = 24 * 60 * 60 * 1000
// Solo Fundador Uno/Dos liberan cupo y dejan rastro anti-recuperación al perderse por mora.
// Pionero no tiene esa restricción (PLAN-SUSCRIPCIONES.md §5/§9).
const FOUNDER_KEYS = new Set(['founder_one', 'founder_two'])

interface Settings {
  reminderDaysBefore: number
  gracePeriodDays: number
}

const DEFAULT_SETTINGS: Settings = { reminderDaysBefore: 5, gracePeriodDays: 5 }

async function readSettings(orm: any): Promise<Settings> {
  const row = (await orm.findMany('Configuration', { hotelId: 'platform', key: 'subscription_settings' }))[0]
  if (!row) return DEFAULT_SETTINGS
  const v = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {})
  return {
    reminderDaysBefore: v.reminderDaysBefore ?? DEFAULT_SETTINGS.reminderDaysBefore,
    gracePeriodDays: v.gracePeriodDays ?? DEFAULT_SETTINGS.gracePeriodDays,
  }
}

/** Libera 1 cupo con CAS (compare-and-swap por igualdad, el único que el ORM permite sin SQL
 *  manual). Si pierde la carrera con otro proceso, no decrementa — se autocorrige en el
 *  próximo recuento manual del admin, no vale la pena reintentar en un cron de fondo. */
async function releaseSlot(orm: any, categoryKey: string): Promise<void> {
  const row = (await orm.findMany('SpecialCategoryConfig', { key: categoryKey }))[0]
  if (!row || row.occupiedCount <= 0) return
  await orm.updateMany(
    'SpecialCategoryConfig',
    { key: categoryKey, occupiedCount: row.occupiedCount },
    { occupiedCount: row.occupiedCount - 1, status: row.status === 'full' ? 'open' : row.status },
  )
}

export interface SuspensionCronResult {
  reminded: number
  pastDue: number
  suspended: number
}

export function createSubscriptionSuspensionCron(
  orm: any,
  resolveModule: (name: string) => any,
  logger: any,
): (now?: Date) => Promise<SuspensionCronResult> {
  return async (now: Date = new Date()): Promise<SuspensionCronResult> => {
    try {
      const platformEmails = resolveModule('platform-emails')
      const { reminderDaysBefore, gracePeriodDays } = await readSettings(orm)
      let reminded = 0
      let pastDue = 0
      let suspended = 0

      const link = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/panel/suscripcion`

      // @ignore IDOR_RISK — hotelId sale de cada Subscription del sistema (cron recorre TODAS
      // las filas de un status dado), nunca de un parámetro de request de cliente.
      async function notify(hotelId: string, event: string, vars: Record<string, string> = {}): Promise<void> {
        if (!platformEmails?.sendEvent) return
        try {
          const hotel = await orm.findById('Hotels', hotelId)
          if (!hotel?.email) return
          await platformEmails.sendEvent(event, hotel.email, hotel.id, { hotel_name: hotel.name, link, ...vars })
        } catch (e: any) {
          logger.warn(`subscription-suspension-cron: no se pudo enviar "${event}"`, { hotelId, error: e.message })
        }
      }

      // 1) Recordatorio a N días del vencimiento (solo active, dedup con renewalReminderSentAt)
      const activeSubs = (await orm.findMany('Subscriptions', { status: 'active' })) as any[]
      for (const sub of activeSubs) {
        if (!sub.currentPeriodEnd || sub.renewalReminderSentAt) continue
        const daysLeft = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now.getTime()) / MS_PER_DAY)
        if (daysLeft !== reminderDaysBefore) continue
        const event = sub.isRecurring ? 'subscription_renewal_auto' : 'subscription_renewal_manual'
        await notify(sub.hotelId, event, { days_left: String(daysLeft) })
        await orm.update('Subscriptions', sub.id, { renewalReminderSentAt: now.toISOString() })
        reminded++
      }

      // 2) active vencidos → past_due (arranca gracia). También cubre el caso en que Stripe ya
      // marcó past_due directo (invoice.payment_failed) sin setear graceEndsAt todavía.
      for (const sub of activeSubs) {
        if (!sub.currentPeriodEnd) continue
        if (new Date(sub.currentPeriodEnd).getTime() > now.getTime()) continue
        const graceEndsAt = new Date(now.getTime() + gracePeriodDays * MS_PER_DAY).toISOString()
        await orm.update('Subscriptions', sub.id, { status: 'past_due', graceEndsAt })
        pastDue++
      }
      const pastDueSubs = (await orm.findMany('Subscriptions', { status: 'past_due' })) as any[]
      for (const sub of pastDueSubs) {
        if (sub.graceEndsAt) continue // ya tiene gracia calculada (por este cron o por el paso anterior)
        const graceEndsAt = new Date(now.getTime() + gracePeriodDays * MS_PER_DAY).toISOString()
        await orm.update('Subscriptions', sub.id, { graceEndsAt })
      }

      // 3) past_due con gracia agotada → suspended
      const stillPastDue = (await orm.findMany('Subscriptions', { status: 'past_due' })) as any[]
      for (const sub of stillPastDue) {
        if (!sub.graceEndsAt || new Date(sub.graceEndsAt).getTime() > now.getTime()) continue

        await orm.update('Subscriptions', sub.id, {
          status: 'suspended', suspendedAt: now.toISOString(), suspendedReason: 'grace_period_expired',
        })

        if (sub.specialCategory && FOUNDER_KEYS.has(sub.specialCategory)) {
          await orm.create('FounderHistory', {
            hotelId: sub.hotelId, category: sub.specialCategory, lostAt: now.toISOString(), reason: 'delinquent',
          })
          await releaseSlot(orm, sub.specialCategory)
          await orm.update('Subscriptions', sub.id, { specialCategory: null, specialCategoryGrantedAt: null })
          // Mismo fix que special-conditions.ts: sin esto el discount category_bonus queda
          // 'active' para siempre aunque el hotel ya perdió la categoría por mora.
          const activeDiscounts = (await orm.findMany('SubscriptionDiscounts', {
            subscriptionId: sub.id, type: 'category_bonus', status: 'active',
          })) as any[]
          for (const d of activeDiscounts) {
            await orm.update('SubscriptionDiscounts', d.id, { status: 'revoked', endsAt: d.endsAt ?? now.toISOString() })
          }
        }

        await notify(sub.hotelId, 'subscription_suspended')
        suspended++
      }

      logger.info('subscription-suspension-cron completado', { reminded, pastDue, suspended })
      return { reminded, pastDue, suspended }
    } catch (e: any) {
      logger.warn('subscription-suspension-cron falló', { error: e.message })
      return { reminded: 0, pastDue: 0, suspended: 0 }
    }
  }
}
