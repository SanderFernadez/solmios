// src/composition-root.ts — SolmiOS
// Entry point. SOLO: config, infra, módulos, conectores, start/stop.

import {
  System, ConfigStore, Logger, Router, MemoryCache, ORM, Container, NodeServer,
} from 'arckode-framework'
import { cors, rateLimit, requestLogger, bodyLimit, timeout, compression } from 'arckode-framework/middlewares'
import { securityHeaders } from './shared/middlewares/security-headers'
import { getClientIp } from './shared/middlewares/rate-limit'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { HotelAuth } from './infrastructure/auth/hotel-auth'
import { registerSharedModels } from './shared/models'
import { configureStripe } from './infrastructure/stripe-config'
import { bootstrapEmail } from './infrastructure/email-bootstrap'
import { createPushAvailability } from './shared/utils/push-availability'
import { createNoShowCron } from './modules/reports/usecases/no-show-cron'
import { createAutoMessagesCron } from './modules/marketing/usecases/auto-messages-cron'
import { createNightAuditCron } from './shared/usecases/night-audit-cron'
import { reservasPaymentRequestsConnector } from './connectors/reservas-payment-requests'

// ─── Config ────────────────────────────────────────────────────────────────
const config = new ConfigStore()
config.define({
  PORT: { type: 'number', default: '3000' },
  JWT_SECRET: { type: 'string', required: true },
  JWT_EXPIRES: { type: 'string', default: '24h' },
  JWT_REFRESH_EXPIRES: { type: 'string', default: '7d' },
  FRONTEND_PORT: { type: 'number', default: 5173 },
})
config.load(process.env)
const PORT = config.get<number>('PORT')

// ─── Infraestructura ───────────────────────────────────────────────────────
const logger = new Logger('info')
// Multi-motor: DATABASE_URL -> Postgres, sino SQLite (DB_PATH). Migración SQLite→Postgres.
const DATABASE_URL = process.env.DATABASE_URL
const db = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({ path: process.env.DB_PATH || './data/managerhotel.db', wal: true, foreignKeys: true })
await db.connect()
const orm = new ORM(db)
registerSharedModels(orm)

const cache = new MemoryCache()
const container = new Container()
const auth = new HotelAuth(jwtTokenAdapter, config.get<string>('JWT_SECRET'), logger, config.get('JWT_EXPIRES'), config.get('JWT_REFRESH_EXPIRES'))
const router = new Router()
const FRONTEND_PORT = config.get<number>('FRONTEND_PORT')
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [`http://localhost:${PORT}`, 'http://localhost:3000', `http://localhost:${FRONTEND_PORT}`]

router.use(cors({ origins: CORS_ORIGINS }))
router.use(securityHeaders())
router.use(bodyLimit(5 * 1024 * 1024))
router.use(requestLogger(logger))
// SEC-4.2: keyBy getClientIp (CF-Connecting-IP / última-XFF). Sin esto el limiter keyeaba por
// remoteAddress = 127.0.0.1 detrás de nginx → un solo bucket para TODOS (inútil o bloquea a todos).
router.use(rateLimit({ windowMs: 60_000, max: 200, keyBy: getClientIp }))
router.use(timeout(30000))
router.use(compression({ threshold: 1024 }))

const http = new NodeServer(PORT, logger)
const system = new System({ config, container, logger, orm, router, http, cache, auth })

// ─── Storage ───────────────────────────────────────────────────────────────
// Con credenciales de Backblaze B2 en el entorno se sube a B2 (S3-compatible);
// si no, al disco local. Mismo patrón que DATABASE_URL para Postgres vs SQLite.
import { StorageService } from 'arckode-framework/modules/storage'
import { LocalStorageAdapter } from 'arckode-framework/modules/storage/local-adapter'
import { serveStatic } from 'arckode-framework/static'
import { S3StorageAdapter, s3ConfigFromEnv } from './infrastructure/storage/s3-adapter'
const s3Config = s3ConfigFromEnv()
const storage = new StorageService(
  s3Config ? new S3StorageAdapter(s3Config) : new LocalStorageAdapter('./uploads', '/uploads'),
)
// El estático local sigue sirviendo lo ya subido a disco aunque se active B2.
serveStatic(router, './uploads', { prefix: '/uploads' })

// ─── Módulos ───────────────────────────────────────────────────────────────
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
import { ReclutamientoModule } from './modules/reclutamiento'
import { ReembolsosModule } from './modules/reembolsos'
import { PayrollModule } from './modules/payroll'
import { AttendanceModule } from './modules/attendance'
import { ActivosModule } from './modules/activos'
import { CapacitacionModule } from './modules/capacitacion'
import { CrmModule } from './modules/crm'
import { MarketingModule } from './modules/marketing'
import { AiRecepcionistaModule } from './modules/ai-recepcionista'
import { AiGerenteModule } from './modules/ai-gerente'
import { BookingengineModule } from './modules/bookingengine'
import { CashModule } from './modules/cash'
import { PaymentRequestsModule } from './modules/payment-requests'
import { AdminModule } from './modules/admin'
import { ReportsModule } from './modules/reports'
import { PricingModule } from './modules/pricing'
import { AmenitiesModule } from './modules/amenities'
import { TtlockModule } from './modules/ttlock'
import { DashboardModule } from './modules/dashboard'
import { FeedbackModule } from './modules/feedback'
import { StaffAuthModule } from './modules/staff-auth'
import { MessagesModule } from './modules/messages'
import { PushTokensModule } from './modules/pushtokens'
import { FcmClient } from './services/fcm-client'

const pushAvailability = createPushAvailability((name) => system.resolveModule(name), logger)

const mods = [
  UsuariosModule({ storage }), HabitacionesModule(), ReservasModule(), HuespedesModule(),
  FacturasModule(), HousekeepingModule({ storage }), MantenimientoModule({ storage }), PaquetesModule(),
  GruposModule(), HotelesModule(), RolesModule(), DispositivosModule(),
  AnunciosModule(), ApikeysModule(), AuditlogModule(), TicketsModule(), NotificacionesModule(),
  CanalesModule(), OpinionesModule(), GastosModule(), FoliosModule(), PaymentsModule(),
  EmpleadosModule({ storage }), PayrollModule(), AttendanceModule(), ActivosModule(), CapacitacionModule(), CrmModule(), MarketingModule(),
  ReclutamientoModule(), ReembolsosModule(),
  AiRecepcionistaModule(), AiGerenteModule(), BookingengineModule({ pushAvailability }),
  CashModule(), PaymentRequestsModule(), AdminModule(), ReportsModule(), PricingModule(),
  AmenitiesModule(), TtlockModule(), DashboardModule(), FeedbackModule(),
  StaffAuthModule(),
  MessagesModule({ storage }),
  PushTokensModule(),
]
for (const m of mods) system.addModule(m as any)

// ─── Conectores ────────────────────────────────────────────────────────────
import { reservasHousekeepingConnector } from './connectors/reservas-housekeeping'
import { reservasTtlockConnector } from './connectors/reservas-ttlock'
import { habitacionesCanalesConnector } from './connectors/habitaciones-canales'
import { reservasCanalesConnector } from './connectors/reservas-canales'
import { mantenimientoNotificacionesConnector } from './connectors/mantenimiento-notificaciones'
import { mantenimientoHabitacionesConnector } from './connectors/mantenimiento-habitaciones'
import { bookingChannexConnector } from './connectors/booking-channex'
import { reservasHuespedesConnector } from './connectors/reservas-huespedes'
import { paymentsCajaConnector } from './connectors/payments-caja'
import { paymentRequestsPaymentsConnector } from './connectors/payment-requests-payments'
import { facturasReservasConnector } from './connectors/facturas-reservas'
import { facturasAuditlogConnector } from './connectors/facturas-auditlog'
import { facturasPaymentsConnector } from './connectors/facturas-payments'
import { foliosFacturasConnector } from './connectors/folios-facturas'
import { foliosPaymentsConnector } from './connectors/folios-payments'
import { reservasFoliosSettlementConnector } from './connectors/reservas-folios-settlement'
import { gastosCajaConnector } from './connectors/gastos-caja'
import { payrollGastosConnector } from './connectors/payroll-gastos'
import { reembolsosGastosConnector } from './connectors/reembolsos-gastos'
import { reservasRescheduleChargeConnector } from './connectors/reservas-reschedule-charge'
import { attendanceDashboardConnector } from './connectors/attendance-dashboard'
import { attendancePayrollConnector } from './connectors/attendance-payroll'
import { bookingenginePaymentsConnector } from './connectors/bookingengine-payments'
import { messagesUsuariosConnector } from './connectors/messages-usuarios'
import { messagesPushtokensConnector } from './connectors/messages-pushtokens'
import { pushtokensUsuariosConnector } from './connectors/pushtokens-usuarios'
import { housekeepingMantenimientoConnector } from './connectors/housekeeping-mantenimiento'
import { housekeepingNotificacionesConnector } from './connectors/housekeeping-notificaciones'

system.addConnector('reservas-housekeeping', reservasHousekeepingConnector)
system.addConnector('reservas-ttlock', reservasTtlockConnector)
system.addConnector('habitaciones-canales', habitacionesCanalesConnector)
system.addConnector('reservas-canales', reservasCanalesConnector)
system.addConnector('mantenimiento-notificaciones', mantenimientoNotificacionesConnector)
system.addConnector('mantenimiento-habitaciones', mantenimientoHabitacionesConnector)
system.addConnector('booking-channex', bookingChannexConnector)
system.addConnector('reservas-huespedes', reservasHuespedesConnector(logger))
system.addConnector('payments-caja', paymentsCajaConnector)
// Un gasto en efectivo saca plata del cajón: sin esto el arqueo del turno no lo ve.
system.addConnector('gastos-caja', gastosCajaConnector)
// Pagar la nómina es un gasto. Cae en `gastos` y de ahí, si fue en efectivo, en la caja.
// Se registra después de gastos-caja para que el egreso encuentre el socket ya inyectado.
system.addConnector('payroll-gastos', payrollGastosConnector)
// Un reembolso pagado es un gasto del hotel; en efectivo cae en la caja (vía gastos-caja).
system.addConnector('reembolsos-gastos', reembolsosGastosConnector)
// Mover/extender una reserva desde el planning cobra la diferencia: folio, efectivo (→caja) o tarjeta (Stripe).
system.addConnector('reservas-reschedule-charge', reservasRescheduleChargeConnector)
// Cablea el prefill de nómina: payroll lee horas de attendance y salarios de empleados.
system.addConnector('attendance-payroll', attendancePayrollConnector)
// El dashboard de RRHH muestra el fichaje real de hoy (presentes/ausentes/tarde) — #198.
system.addConnector('attendance-dashboard', attendanceDashboardConnector)
system.addConnector('facturas-reservas', facturasReservasConnector)
system.addConnector('facturas-auditlog', facturasAuditlogConnector)
// El dinero se asienta en `payments` → payments-caja lo lleva al arqueo y a la conciliación.
system.addConnector('facturas-payments', facturasPaymentsConnector)
system.addConnector('folios-payments', foliosPaymentsConnector)
// Un cobro Stripe también es dinero: sin esto queda fuera de `payments` y de la conciliación.
system.addConnector('payment-requests-payments', paymentRequestsPaymentsConnector)
// El widget público cobra con Stripe: ese dinero vivía solo en la tabla `bookings`.
system.addConnector('bookingengine-payments', bookingenginePaymentsConnector)
system.addConnector('reservas-payment-requests', reservasPaymentRequestsConnector(orm))
// folios-facturas debe registrarse antes que reservas-folios-settlement:
// el settlement del checkout usa folios.closeAndCreateInvoice(), que necesita el puerto inyectado.
system.addConnector('folios-facturas', foliosFacturasConnector)
system.addConnector('reservas-folios-settlement', reservasFoliosSettlementConnector)
// El chat resuelve nombres de compañeros sin pasar por `users:view`.
system.addConnector('messages-usuarios', messagesUsuariosConnector)
// Un mensaje nuevo le llega al teléfono aunque la app esté cerrada.
system.addConnector('messages-pushtokens', messagesPushtokensConnector)
// El aviso dice el nombre de quien escribió, no su id.
system.addConnector('pushtokens-usuarios', pushtokensUsuariosConnector)
// Lo que la camarera reporta como roto se convierte en un ticket con fotos.
system.addConnector('housekeeping-mantenimiento', housekeepingMantenimientoConnector)
// Asignar una habitación le avisa a la persona asignada.
system.addConnector('housekeeping-notificaciones', housekeepingNotificacionesConnector)

// ─── Infraestructura transversal ────────────────────────────────────────────
configureStripe(orm)

// ─── Schema sync (modo migrate-only) ────────────────────────────────────────
// RUN_MIGRATE=1: crea tablas faltantes desde los modelos registrados (para módulos
// sin migración como folios, amenities, companions, locks, plans, rates, etc.).
// Idempotente (CREATE TABLE IF NOT EXISTS). Usa system.init() (que registra modelos
// vía orm.define en cada módulo) en vez de system.start() — init() no bindea el
// puerto HTTP (PORT), así no choca con el servicio que ya corre. start() sí lo bindea.
if (process.env.RUN_MIGRATE === '1') {
  system.init()
  await orm.migrate()
  logger.info('orm.migrate() completado: tablas sincronizadas desde modelos')
  await system.stop()
  process.exit(0)
}

// ─── Start ─────────────────────────────────────────────────────────────────
await system.start()

const { emailService, startWorker } = bootstrapEmail(orm, logger, (name) => system.resolveModule(name))

// Post-init: ai-recepcionista usa pushAvailability (reservas IA bypassan el módulo reservas).
const aiRecepcionista = system.resolveModule<{ channexPusher: ((hotelId: string, roomId: string) => void) | null }>('ai-recepcionista')
if (aiRecepcionista) aiRecepcionista.channexPusher = pushAvailability

// Post-init: los avisos al teléfono. Sin credenciales de Firebase `fromEnv`
// devuelve null y el módulo se queda solo guardando tokens: la app sigue
// avisando mientras está abierta, que es lo que hacía antes de todo esto.
const fcm = FcmClient.fromEnv(logger)
if (fcm) {
  const pushTokens = system.resolveModule<{ setSender: (s: FcmClient) => void }>('pushtokens')
  pushTokens?.setSender(fcm)
}

startWorker()

// ─── Cron jobs ──────────────────────────────────────────────────────────────
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const noShowCron = createNoShowCron(orm, emailService, logger)
setInterval(() => { noShowCron().catch((e) => logger.warn('markNoShows failed', { error: (e as Error).message })) }, ONE_DAY_MS)

const AUTO_MESSAGES_TICK_MS = 60_000 * 60
const autoMsgTrigger = system.resolveModule<{ triggerAutoMessages: (params: any) => Promise<void> }>('marketing')
if (autoMsgTrigger) {
  const autoMsgCron = createAutoMessagesCron(orm, autoMsgTrigger)
  setInterval(() => { autoMsgCron().catch((e) => logger.warn('auto-messages cron failed', { error: (e as Error).message })) }, AUTO_MESSAGES_TICK_MS)
  logger.info('Auto-messages cron listo', { tickMs: AUTO_MESSAGES_TICK_MS })
}

const NIGHT_AUDIT_TICK_MS = 60_000 * 60 * 3 // cada 3h (postea si hay nuevas reservas in-house)
const nightAuditCron = createNightAuditCron(orm, (name) => system.resolveModule(name), logger)
setTimeout(() => {
  nightAuditCron().catch((e) => logger.warn('night-audit initial run failed', { error: (e as Error).message }))
}, 10_000) // primer corrida a los 10s de iniciar
setInterval(() => {
  nightAuditCron().catch((e) => logger.warn('night-audit cron failed', { error: (e as Error).message }))
}, NIGHT_AUDIT_TICK_MS)
logger.info('Night-audit cron listo', { tickMs: NIGHT_AUDIT_TICK_MS })

// ─── Shutdown ──────────────────────────────────────────────────────────────
process.on('SIGINT', async () => { await system.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await system.stop(); process.exit(0) })
