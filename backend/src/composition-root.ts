// src/composition-root.ts — SolmiOS
// Entry point con arckode-framework. Estructura canónica: System → módulos → start.

import {
  System, ConfigStore, Logger, Router, MemoryCache, ORM, Container, OrmRepository, NodeServer,
} from 'arckode-framework'
import { cors, rateLimit, requestLogger, bodyLimit, timeout, compression } from 'arckode-framework/middlewares'
import { securityHeaders } from './shared/middlewares/security-headers'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { HotelAuth } from './infrastructure/auth/hotel-auth'
import { EmailService } from './services/email-service'
import type { EmailQueueDTO } from './services/email-service'
import { NotificationRenderer, type AutoMessageTemplateRow } from './services/notification-renderer'
import type { EmailSender } from './services/email-sender'
import { registerSharedModels } from './shared/models'
import { createNoShowCron } from './modules/reports/usecases/no-show-cron'
import { createAutoMessagesCron } from './modules/marketing/usecases/auto-messages-cron'
import { reservasPaymentRequestsConnector } from './connectors/reservas-payment-requests'

// ─── Config (todo desde .env) ──────────────────────────────────────────────
const config = new ConfigStore()
config.define({
  PORT: { type: 'number', default: '3000' },
  JWT_SECRET: { type: 'string', required: true },
  JWT_EXPIRES: { type: 'string', default: '24h' },
  JWT_REFRESH_EXPIRES: { type: 'string', default: '7d' },
  FRONTEND_PORT: { type: 'number', default: 5173 },
})
config.load(process.env)
const JWT_SECRET = config.get<string>('JWT_SECRET')
const PORT = config.get<number>('PORT')

// ─── Logger / DB / ORM ─────────────────────────────────────────────────────
const logger = new Logger('info')
const db = new SqliteAdapter({ path: './data/managerhotel.db', wal: true, foreignKeys: true })
await db.connect()
const orm = new ORM(db)

registerSharedModels(orm)

// ─── Infraestructura del sistema ──────────────────────────────────────────
const cache = new MemoryCache()
const container = new Container()
const auth = new HotelAuth(jwtTokenAdapter, JWT_SECRET, logger, config.get('JWT_EXPIRES'), config.get('JWT_REFRESH_EXPIRES'))
const router = new Router()
const FRONTEND_PORT = config.get<number>('FRONTEND_PORT')
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [`http://localhost:${PORT}`, 'http://localhost:3000', `http://localhost:${FRONTEND_PORT}`]
router.use(cors({ origins: CORS_ORIGINS }))
router.use(securityHeaders())
router.use(bodyLimit(5 * 1024 * 1024))
router.use(requestLogger(logger))
router.use(rateLimit({ windowMs: 60_000, max: 200 }))
router.use(timeout(30000))
router.use(compression({ threshold: 1024 }))
const http = new NodeServer(PORT, logger)

// ─── System ────────────────────────────────────────────────────────────────
const system = new System({ config, container, logger, orm, router, http, cache, auth })

// ─── Módulos (cada uno independiente, estructura canónica) ─────────────────
import { HabitacionesModule } from './modules/habitaciones'
import { ReservasModule } from './modules/reservas'
import { HuespedesModule } from './modules/huespedes'
import { FacturasModule } from './modules/facturas'
import { HousekeepingModule } from './modules/housekeeping'
import { MantenimientoModule } from './modules/mantenimiento'
import { PaquetesModule } from './modules/paquetes'
import { GruposModule } from './modules/grupos'
import { HotelesModule } from './modules/hoteles'
import { UsuariosModule } from './modules/usuarios'
import { RolesModule } from './modules/roles'
import { DispositivosModule } from './modules/dispositivos'
import { AnunciosModule } from './modules/anuncios'
import { ApikeysModule } from './modules/apikeys'
import { AuditlogModule } from './modules/auditlog'
import { TicketsModule } from './modules/tickets'
import { NotificacionesModule } from './modules/notificaciones'
import { CanalesModule } from './modules/canales'
import { OpinionesModule } from './modules/opiniones'
import { GastosModule } from './modules/gastos'
import { FoliosModule } from './modules/folios'
import { PaymentsModule } from './modules/payments'
import { EmpleadosModule } from './modules/empleados'
import { PayrollModule } from './modules/payroll'
import { AttendanceModule } from './modules/attendance'
import { CrmModule } from './modules/crm'
import { MarketingModule } from './modules/marketing'
import { AiRecepcionistaModule } from './modules/ai-recepcionista'
import { AiGerenteModule } from './modules/ai-gerente'
import { BookingengineModule } from './modules/bookingengine'
import { AdminModule } from './modules/admin'
import { ReportsModule } from './modules/reports'
import { PricingModule } from './modules/pricing'
import { AmenitiesModule } from './modules/amenities'
import { TtlockModule } from './modules/ttlock'
import { DashboardModule } from './modules/dashboard'
import { FeedbackModule } from './modules/feedback'

import { StorageService } from 'arckode-framework/modules/storage'
import { LocalStorageAdapter } from 'arckode-framework/modules/storage/local-adapter'
import { serveStatic } from 'arckode-framework/static'

// ─── Storage (uploads) ──────────────────────────────────────────────────────
const storage = new StorageService(new LocalStorageAdapter('./uploads', '/uploads'))
serveStatic(router, './uploads', { prefix: '/uploads' })

import { CashModule } from './modules/cash'
import { PaymentRequestsModule } from './modules/payment-requests'

// Helper: dispara recálculo de availability en Channex (fire-and-forget).
const pushAvailabilityToChannex = (hotelId: string, roomId: string): void => {
  const canales = system.resolveModule<{ pushAvailabilityByRoom: (h: string, r: string) => Promise<{ pushed: boolean }> }>('canales')
  if (!canales?.pushAvailabilityByRoom) return
  void canales.pushAvailabilityByRoom(hotelId, roomId).catch((e: unknown) =>
    logger.warn('pushAvailability Channex falló', { hotelId, roomId, error: String(e) }),
  )
}

const mods = [
  UsuariosModule(), HabitacionesModule(), ReservasModule(), HuespedesModule(),
  FacturasModule(), HousekeepingModule({ storage }), MantenimientoModule({ storage }), PaquetesModule(),
  GruposModule(), HotelesModule(), RolesModule(), DispositivosModule(),
  AnunciosModule(), ApikeysModule(), AuditlogModule(), TicketsModule(), NotificacionesModule(),
  CanalesModule(),
  OpinionesModule(), GastosModule(), FoliosModule(), PaymentsModule(), EmpleadosModule(), PayrollModule(), AttendanceModule(), CrmModule(), MarketingModule(), AiRecepcionistaModule(), AiGerenteModule(),
  BookingengineModule({ pushAvailability: pushAvailabilityToChannex }),
  CashModule(),
  PaymentRequestsModule(),
  AdminModule(),
  ReportsModule(),
  PricingModule(),
  AmenitiesModule(),
  TtlockModule(),
  DashboardModule(),
  FeedbackModule(),
]
for (const m of mods) system.addModule(m as any)

// ─── Conectores ────────────────────────────────────────────────────────────
import { reservasHousekeepingConnector } from './connectors/reservas-housekeeping'
system.addConnector('reservas-housekeeping', reservasHousekeepingConnector)

import { reservasTtlockConnector } from './connectors/reservas-ttlock'
system.addConnector('reservas-ttlock', reservasTtlockConnector)

import { habitacionesCanalesConnector } from './connectors/habitaciones-canales'
system.addConnector('habitaciones-canales', habitacionesCanalesConnector)

import { reservasCanalesConnector } from './connectors/reservas-canales'
system.addConnector('reservas-canales', reservasCanalesConnector)

import { mantenimientoNotificacionesConnector } from './connectors/mantenimiento-notificaciones'
system.addConnector('mantenimiento-notificaciones', mantenimientoNotificacionesConnector)

import { mantenimientoHabitacionesConnector } from './connectors/mantenimiento-habitaciones'
system.addConnector('mantenimiento-habitaciones', mantenimientoHabitacionesConnector)

import { bookingChannexConnector } from './connectors/booking-channex'
system.addConnector('booking-channex', bookingChannexConnector)

import { reservasHuespedesConnector } from './connectors/reservas-huespedes'
system.addConnector('reservas-huespedes', reservasHuespedesConnector)

import { paymentsCajaConnector } from './connectors/payments-caja'
system.addConnector('payments-caja', paymentsCajaConnector)

import { facturasReservasConnector } from './connectors/facturas-reservas'
system.addConnector('facturas-reservas', facturasReservasConnector)

// ─── Stripe config resolver ──────────────────────────────────────────
import { StripeService } from './services/stripe-service'
StripeService.setConfigResolver(async (hotelId) => {
  if (!hotelId) return null
  const rows = await orm.findMany('Configuration', { hotelId, key: 'stripe_config' }) as any[]
  const v = rows[0]?.value
  let cfg: any = v
  if (typeof v === 'string') { try { cfg = JSON.parse(v) } catch { cfg = null } }
  return cfg || null
})

// ─── Start ─────────────────────────────────────────────────────────────────
await system.start()

// Post-init: inyectar pushAvailability en ai-recepcionista (reservas IA bypassan el módulo reservas).
const aiRecepcionista = system.resolveModule<{ channexPusher: ((hotelId: string, roomId: string) => void) | null }>('ai-recepcionista')
if (aiRecepcionista) aiRecepcionista.channexPusher = pushAvailabilityToChannex

// ─── EmailService transversal (SMTP/Resend + cola con reintentos) ───────────
const EMAIL_WORKER_TICK_MS = 30_000
const emailConfigRepo = new OrmRepository<Record<string, unknown>>(orm, 'Configuration')
const emailQueueRepo = new OrmRepository<EmailQueueDTO>(orm, 'EmailQueue')
const notificationRenderer = new NotificationRenderer(new OrmRepository<AutoMessageTemplateRow>(orm, 'AutoMessages'), logger)
const emailService = new EmailService(emailConfigRepo, emailQueueRepo, logger, notificationRenderer)
const reservasForEmail = system.resolveModule<{ setEmailDeps(es: EmailSender, r: any): void }>('reservas')
if (reservasForEmail && typeof reservasForEmail.setEmailDeps === 'function') {
  reservasForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'MessageLogs'))
}
const facturasForEmail = system.resolveModule<{ setEmailDeps(ep: any, hr: any): void }>('facturas')
if (facturasForEmail && typeof facturasForEmail.setEmailDeps === 'function') {
  facturasForEmail.setEmailDeps(emailService, new OrmRepository<any>(orm, 'Hotels'))
}

// Marketing: inyectar triggerDeps para auto-messages
const marketingSvc = system.resolveModule<{ setTriggerDeps(deps: any): void }>('marketing')
if (marketingSvc && typeof marketingSvc.setTriggerDeps === 'function') {
  marketingSvc.setTriggerDeps({
    emailSender: emailService,
    guestRepo: new OrmRepository<any>(orm, 'Guests'),
    roomRepo: new OrmRepository<any>(orm, 'Rooms'),
    hotelRepo: new OrmRepository<any>(orm, 'Hotels'),
  })
}

// ─── Auto PaymentRequest + Audit trail (reservas sockets) ──────────────────
system.addConnector('reservas-payment-requests', reservasPaymentRequestsConnector)
await emailService.reclaimStale()
setInterval(() => {
  emailService.processQueue().catch((e) => logger.error('email worker tick', { error: (e as Error).message }))
  emailService.reclaimStale().catch((e) => logger.error('email worker reclaim', { error: (e as Error).message }))
}, EMAIL_WORKER_TICK_MS)
logger.info('EmailService worker listo', { tickMs: EMAIL_WORKER_TICK_MS })

// ─── No-show cron (diario) ─────────────────────────────────────────────────
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const noShowCron = createNoShowCron(orm, emailService, logger)
setInterval(() => { noShowCron().catch((e) => logger.warn('markNoShows failed', { error: (e as Error).message })) }, ONE_DAY_MS)

// ─── Auto-Messages Cron Job (cada hora) ─────────────────────────────────────
const AUTO_MESSAGES_TICK_MS = 60_000 * 60
const autoMsgTrigger = system.resolveModule<{ triggerAutoMessages: (params: any) => Promise<void> }>('marketing')
if (autoMsgTrigger) {
  const autoMsgCron = createAutoMessagesCron(orm, autoMsgTrigger)
  setInterval(() => { autoMsgCron().catch((e) => logger.warn('auto-messages cron failed', { error: (e as Error).message })) }, AUTO_MESSAGES_TICK_MS)
  logger.info('Auto-messages cron listo', { tickMs: AUTO_MESSAGES_TICK_MS })
}

process.on('SIGINT', async () => { await system.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await system.stop(); process.exit(0) })
