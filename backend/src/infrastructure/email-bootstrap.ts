import { OrmRepository } from 'arckode-framework'
import { EmailService } from '../services/email-service'
import type { EmailQueueDTO } from '../services/email-service'
import { NotificationRenderer, type AutoMessageTemplateRow } from '../services/notification-renderer'
import type { EmailSender } from '../services/email-sender'
import type { Logger } from 'arckode-framework'

export interface EmailBootstrapResult {
  emailService: EmailService
  startWorker: () => void
}

export function bootstrapEmail(orm: any, logger: Logger, resolveModule: <T>(name: string) => T | null): EmailBootstrapResult {
  const emailConfigRepo = new OrmRepository<Record<string, unknown>>(orm, 'Configuration')
  const emailQueueRepo = new OrmRepository<EmailQueueDTO>(orm, 'EmailQueue')
  const notificationRenderer = new NotificationRenderer(new OrmRepository<AutoMessageTemplateRow>(orm, 'AutoMessages'), logger)
  const emailService = new EmailService(emailConfigRepo, emailQueueRepo, logger, notificationRenderer)

  const reservasForEmail = resolveModule<{ setEmailDeps(es: EmailSender, r: any): void }>('reservas')
  if (reservasForEmail && typeof reservasForEmail.setEmailDeps === 'function') {
    reservasForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'MessageLogs'))
  }

  const facturasForEmail = resolveModule<{ setEmailDeps(ep: any, hr: any): void }>('facturas')
  if (facturasForEmail && typeof facturasForEmail.setEmailDeps === 'function') {
    facturasForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'Hotels'))
  }

  // Payroll: envío de recibos de nómina por email (#157) + nombre del hotel para el A4.
  const payrollForEmail = resolveModule<{ setEmailDeps(ep: any, hr: any): void }>('payroll')
  if (payrollForEmail && typeof payrollForEmail.setEmailDeps === 'function') {
    payrollForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'Hotels'))
  }

  // Payment-requests: envía el link de pago (Stripe) por email al generar el checkout (sentVia='email').
  const payReqForEmail = resolveModule<{ setEmailDeps(es: any, hr: any): void }>('payment-requests')
  if (payReqForEmail && typeof payReqForEmail.setEmailDeps === 'function') {
    payReqForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'Hotels'))
  }

  // Opiniones: email de invitación a reseña post-checkout con link público /resena/:token.
  const opinionesForEmail = resolveModule<{ setEmailDeps(es: any, gr: any, hr: any, url: string): void }>('opiniones')
  if (opinionesForEmail && typeof opinionesForEmail.setEmailDeps === 'function') {
    opinionesForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'Guests'), new OrmRepository<any>(orm, 'Hotels'), process.env.PUBLIC_URL || '')
  }

  // Capacitación: correo de inscripción con material + link de autoconfirmación. PUBLIC_URL arma el
  // link absoluto del correo (ej: https://hotel.zx89.site); sin él, el correo va sin botón de confirmar.
  const capacitacionForEmail = resolveModule<{ setEmailDeps(es: EmailSender, ur: any, publicUrl?: string): void }>('capacitacion')
  if (capacitacionForEmail && typeof capacitacionForEmail.setEmailDeps === 'function') {
    capacitacionForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'Users'), process.env.PUBLIC_URL)
  }

  // Verificación de email del alta (#421): el correo con el link va al registrarse, y el reenvío
  // desde el banner del panel. PUBLIC_URL arma el link absoluto.
  const subsForEmail = resolveModule<{ setEmailDeps(es: EmailSender, url?: string): void }>('subscriptions')
  if (subsForEmail && typeof subsForEmail.setEmailDeps === 'function') {
    subsForEmail.setEmailDeps(emailService, process.env.PUBLIC_URL)
  }
  const usuariosForEmail = resolveModule<{ setEmailVerificationDeps(es: EmailSender, url: string): void }>('usuarios')
  if (usuariosForEmail && typeof usuariosForEmail.setEmailVerificationDeps === 'function') {
    usuariosForEmail.setEmailVerificationDeps(emailService, process.env.PUBLIC_URL || '')
  }

  const marketingSvc = resolveModule<{ setTriggerDeps(deps: any): void }>('marketing')
  if (marketingSvc && typeof marketingSvc.setTriggerDeps === 'function') {
    marketingSvc.setTriggerDeps({
      emailSender: emailService,
      guestRepo: new OrmRepository<any>(orm, 'Guests'),
      roomRepo: new OrmRepository<any>(orm, 'Rooms'),
      hotelRepo: new OrmRepository<any>(orm, 'Hotels'),
    })
  }

  const EMAIL_WORKER_TICK_MS = 30_000
  const startWorker = () => {
    emailService.reclaimStale().catch(() => {})
    setInterval(() => {
      emailService.processQueue().catch((e) => logger.error('email worker tick', { error: (e as Error).message }))
      emailService.reclaimStale().catch((e) => logger.error('email worker reclaim', { error: (e as Error).message }))
    }, EMAIL_WORKER_TICK_MS)
    logger.info('EmailService worker listo', { tickMs: EMAIL_WORKER_TICK_MS })
  }

  return { emailService, startWorker }
}
