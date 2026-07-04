// src/composition-root.ts — SolmiOS
// Entry point. SOLO: config, infra, módulos, conectores, start/stop.

import {
  System, ConfigStore, Logger, Router, MemoryCache, ORM, Container, NodeServer,
} from 'arckode-framework'
import { cors, rateLimit, requestLogger, bodyLimit, timeout, compression } from 'arckode-framework/middlewares'
import { securityHeaders } from './shared/middlewares/security-headers'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import { ormMigrate } from '../scripts/orm-migrate'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { HotelAuth } from './infrastructure/auth/hotel-auth'
import { registerSharedModels } from './shared/models'
import { configureStripe } from './infrastructure/stripe-config'
import { bootstrapEmail } from './infrastructure/email-bootstrap'
import { createPushAvailability } from './shared/utils/push-availability'
import { createNoShowCron } from './modules/reports/usecases/no-show-cron'
import { createAutoMessagesCron } from './modules/marketing/usecases/auto-messages-cron'
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
router.use(rateLimit({ windowMs: 60_000, max: 200 }))
router.use(timeout(30000))
router.use(compression({ threshold: 1024 }))

const http = new NodeServer(PORT, logger)
const system = new System({ config, container, logger, orm, router, http, cache, auth })

// ─── Storage ───────────────────────────────────────────────────────────────
import { StorageService } from 'arckode-framework/modules/storage'
import { LocalStorageAdapter } from 'arckode-framework/modules/storage/local-adapter'
import { serveStatic } from 'arckode-framework/static'
const storage = new StorageService(new LocalStorageAdapter('./uploads', '/uploads'))
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
import { PayrollModule } from './modules/payroll'
import { AttendanceModule } from './modules/attendance'
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

const pushAvailability = createPushAvailability((name) => system.resolveModule(name), logger)

const mods = [
  UsuariosModule(), HabitacionesModule(), ReservasModule(), HuespedesModule(),
  FacturasModule(), HousekeepingModule({ storage }), MantenimientoModule({ storage }), PaquetesModule(),
  GruposModule(), HotelesModule(), RolesModule(), DispositivosModule(),
  AnunciosModule(), ApikeysModule(), AuditlogModule(), TicketsModule(), NotificacionesModule(),
  CanalesModule(), OpinionesModule(), GastosModule(), FoliosModule(), PaymentsModule(),
  EmpleadosModule(), PayrollModule(), AttendanceModule(), CrmModule(), MarketingModule(),
  AiRecepcionistaModule(), AiGerenteModule(), BookingengineModule({ pushAvailability }),
  CashModule(), PaymentRequestsModule(), AdminModule(), ReportsModule(), PricingModule(),
  AmenitiesModule(), TtlockModule(), DashboardModule(), FeedbackModule(),
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
import { facturasReservasConnector } from './connectors/facturas-reservas'

system.addConnector('reservas-housekeeping', reservasHousekeepingConnector)
system.addConnector('reservas-ttlock', reservasTtlockConnector)
system.addConnector('habitaciones-canales', habitacionesCanalesConnector)
system.addConnector('reservas-canales', reservasCanalesConnector)
system.addConnector('mantenimiento-notificaciones', mantenimientoNotificacionesConnector)
system.addConnector('mantenimiento-habitaciones', mantenimientoHabitacionesConnector)
system.addConnector('booking-channex', bookingChannexConnector)
system.addConnector('reservas-huespedes', reservasHuespedesConnector)
system.addConnector('payments-caja', paymentsCajaConnector)
system.addConnector('facturas-reservas', facturasReservasConnector)
system.addConnector('reservas-payment-requests', reservasPaymentRequestsConnector(orm))

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
  await ormMigrate(db, (orm as any).models)
  logger.info('ormMigrate completado: tablas sincronizadas desde modelos')
  await system.stop()
  process.exit(0)
}

// ─── Start ─────────────────────────────────────────────────────────────────
await system.start()

const { emailService, startWorker } = bootstrapEmail(orm, logger, (name) => system.resolveModule(name))

// Post-init: ai-recepcionista usa pushAvailability (reservas IA bypassan el módulo reservas).
const aiRecepcionista = system.resolveModule<{ channexPusher: ((hotelId: string, roomId: string) => void) | null }>('ai-recepcionista')
if (aiRecepcionista) aiRecepcionista.channexPusher = pushAvailability

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

// ─── Shutdown ──────────────────────────────────────────────────────────────
process.on('SIGINT', async () => { await system.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await system.stop(); process.exit(0) })
