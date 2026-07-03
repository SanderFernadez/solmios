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
