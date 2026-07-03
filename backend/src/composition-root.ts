// src/composition-root.ts — ManagerHotel / SOLMI OS
// Entry point con arckode-framework. Estructura canónica: System → módulos → start.

import {
  System, ConfigStore, Logger, Router, MemoryCache, ORM, Container, OrmRepository, NodeServer,
} from 'arckode-framework'
import { cors, rateLimit, requestLogger, bodyLimit, timeout, compression } from 'arckode-framework/middlewares'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { HotelAuth } from './infrastructure/auth/hotel-auth'
import { EmailService } from './services/email-service'
import type { EmailQueueDTO } from './services/email-service'
import { NotificationRenderer, type AutoMessageTemplateRow } from './services/notification-renderer'
import type { EmailSender } from './services/email-sender'
import { dispatchLifecycleEmail } from './modules/reservas/usecases/lifecycle-email'
import { registerSharedModels } from './shared/models'

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

// Registrar modelos compartidos
registerSharedModels(orm)

// ─── Infraestructura del sistema ──────────────────────────────────────────
const cache = new MemoryCache()
const container = new Container()
const auth = new HotelAuth(jwtTokenAdapter, JWT_SECRET, logger, config.get('JWT_EXPIRES'), config.get('JWT_REFRESH_EXPIRES'))
const router = new Router()
const FRONTEND_PORT = config.get<number>('FRONTEND_PORT')
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [`http://localhost:${PORT}`, 'http://localhost:3000', `http://localhost:${FRONTEND_PORT}`]
router.use(cors({ origins: CORS_ORIGINS }))
router.use(async (req: any, next: any) => {
  const res = await next(req)
  return {
    ...res,
    headers: {
      ...res?.headers,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  }
})
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
// LocalStorageAdapter guarda en ./uploads con anti-path-traversal; serveStatic
// sirve los archivos en /uploads/*. Reutilizable: al llegar S3, se cambia el
// adapter acá y el resto del sistema no se entera.
const storage = new StorageService(new LocalStorageAdapter('./uploads', '/uploads'))
serveStatic(router, './uploads', { prefix: '/uploads' })

import { CashModule } from './modules/cash'
import { PaymentRequestsModule } from './modules/payment-requests'
const mods = [
  UsuariosModule(), HabitacionesModule(), ReservasModule(), HuespedesModule(),
  FacturasModule(), HousekeepingModule({ storage }), MantenimientoModule({ storage }), PaquetesModule(),
  GruposModule(), HotelesModule(), RolesModule(), DispositivosModule(),
  AnunciosModule(), ApikeysModule(), AuditlogModule(), TicketsModule(), NotificacionesModule(),
  CanalesModule(),
  OpinionesModule(), GastosModule(), FoliosModule(), PaymentsModule(), EmpleadosModule(), PayrollModule(), AttendanceModule(), CrmModule(), MarketingModule(), AiRecepcionistaModule(), AiGerenteModule(), BookingengineModule(),
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

// ─── Conector: reservas → housekeeping (check-out dispara limpieza) ────────
import { reservasHousekeepingConnector } from './connectors/reservas-housekeeping'
system.addConnector('reservas-housekeeping', reservasHousekeepingConnector)

// ─── Conector: reservas → ttlock (check-out expira códigos de cerradura) ──
import { reservasTtlockConnector } from './connectors/reservas-ttlock'
system.addConnector('reservas-ttlock', reservasTtlockConnector)

// ─── Conector: habitaciones → canales (cambio de precioBase → push tarifa Channex)
import { habitacionesCanalesConnector } from './connectors/habitaciones-canales'
system.addConnector('habitaciones-canales', habitacionesCanalesConnector)

// ─── Conector: reservas → canales (crear/cancelar reserva vía módulo → push availability Channex)
import { reservasCanalesConnector } from './connectors/reservas-canales'
system.addConnector('reservas-canales', reservasCanalesConnector)

// ─── Conector: mantenimiento → notificaciones (crear/completar orden → notificar)
import { mantenimientoNotificacionesConnector } from './connectors/mantenimiento-notificaciones'
system.addConnector('mantenimiento-notificaciones', mantenimientoNotificacionesConnector)

// ─── Conector: mantenimiento → habitaciones (cerrar orden → room dirty)
import { mantenimientoHabitacionesConnector } from './connectors/mantenimiento-habitaciones'
system.addConnector('mantenimiento-habitaciones', mantenimientoHabitacionesConnector)

// ─── Conector: booking-engine → canales (sync availability después de reserva directa)
import { bookingChannexConnector } from './connectors/booking-channex'
system.addConnector('booking-channex', bookingChannexConnector)

// ─── Conector: reservas → huéspedes (check-out actualiza stats + puntos) ────
import { reservasHuespedesConnector } from './connectors/reservas-huespedes'
system.addConnector('reservas-huespedes', reservasHuespedesConnector)

// ─── Conector: payments → caja (pago cash completado → ingreso automático en caja)
import { paymentsCajaConnector } from './connectors/payments-caja'
system.addConnector('payments-caja', paymentsCajaConnector)

import { facturasReservasConnector } from './connectors/facturas-reservas'
system.addConnector('facturas-reservas', facturasReservasConnector)

// Helper: dispara recálculo de availability en Channex (fire-and-forget; no bloquea la respuesta HTTP).
// Lo usan los handlers custom (check-in/checkout/booking público/bloqueos) que bypassan el módulo
// reservas y por tanto no disparan el conector reservas-canales (sockets).
const pushAvailabilityToChannex = (hotelId: string, roomId: string): void => {
  const canales = system.resolveModule<{ pushAvailabilityByRoom: (h: string, r: string) => Promise<{ pushed: boolean }> }>('canales')
  if (!canales?.pushAvailabilityByRoom) return
  void canales.pushAvailabilityByRoom(hotelId, roomId).catch((e: unknown) =>
    logger.warn('pushAvailability Channex falló', { hotelId, roomId, error: String(e) }),
  )
}

// ─── Endpoints de agregación (cross-module, registrados en el root) ────────
// Estos leen de varios módulos vía ORM (read-only) — no pertenecen a un solo módulo.
// hotelOf resuelve el hotel del scope multi-tenant: query explícita > hotel del usuario autenticado > fallback.
// El fallback al primer hotel SOLO aplica para super_admin sin hotelId (vistas de plataforma).
const hotelOf = async (req: any): Promise<string | undefined> => {
  const q = req?.query || {}
  if (q.hotelId) return q.hotelId as string
  const userHotel = req?.user?.hotelId
  if (userHotel && userHotel !== 'platform') return userHotel as string
  // Blindaje para tokens legacy (pre-deploy, sin hotelId) y cualquier hotel_admin cuyo token
  // no traiga hotelId: resolver desde la DB del usuario antes de caer al fallback "primer hotel"
  // (que devolvería datos de otro hotel).
  if (req?.user?.id && req?.user?.role !== 'super_admin') {
    const uRows = await orm.findMany('Users', { id: req.user.id })
    const u: any = (uRows as any[])?.[0]
    if (u?.hotelId && u.hotelId !== 'platform') return u.hotelId as string
  }
  // Fallback final: super_admin sin hotel asignado (vista de plataforma) → primer hotel.
  return ((await orm.findMany('Hotels', {}))[0] as any)?.id
}
const today = () => new Date().toISOString().split('T')[0]


// No-show automático: marca 'no_show' las reservas pendientes/confirmadas cuyo check-in ya pasó.
async function markNoShows(): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0]
  const reservas = (await orm.findMany('Reservations', {})) as any[]
  let count = 0
  for (const r of reservas) {
    const ci = String(r.checkIn || '').slice(0, 10)
    if ((r.status === 'pending' || r.status === 'confirmed') && ci && ci < todayStr) {
      await orm.update('Reservations', r.id, { status: 'no_show' })
      count++
      // D3 — email de no_show al huésped (fire-and-forget; no bloquea el job de night audit).
      dispatchLifecycleEmail(
        { emailSender: emailService, guestRepo: new OrmRepository<any>(orm, 'Guests'), roomRepo: new OrmRepository<any>(orm, 'Rooms'), hotelRepo: new OrmRepository<any>(orm, 'Hotels'), messageLogRepo: new OrmRepository<any>(orm, 'MessageLogs'), logger },
        { reservationId: r.id, hotelId: r.hotelId, guestId: r.guestId, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut, event: 'no_show' },
      ).catch((e) => logger.warn('no-show email', { reservationId: r.id, error: (e as Error).message }))
    }
  }
  return count
}
// Job diario automático (DEUDA TÉCNICA: mover a cron configurable / queue worker dedicado).
const ONE_DAY_MS = 24 * 60 * 60 * 1000
setInterval(() => { markNoShows().catch((e) => logger.warn('markNoShows failed', { error: (e as Error).message })) }, ONE_DAY_MS)


function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

// Endpoint público — cuentas demo dinámicas desde la DB (campo users.isDemo=1).
// Sin lista hardcodeada: para agregar/quitar una cuenta demo, se marca isDemo en la tabla.
router.get('/api/public/users', async () => {
  const rows = (await orm.findMany('Users', { isDemo: 1, active: 1 })) as any[]
  const body = rows
    .filter((u) => u && u.email)
    .map((u) => ({ name: u.name, email: u.email, role: u.role }))
  return { status: 200, body }
})

// ─── Public booking widget (sin auth) ─────────────────────────────────────
router.get('/api/public/booking/:slug', async (req) => {
  const slug = req.params.slug
  const q = (req.query || {}) as any
  const hotels = await orm.findMany('Hotels', {}) as any[]
  const hotel = hotels.find((h: any) => h.name?.toLowerCase().replace(/\s+/g, '-') === slug || h.id === slug)
  if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }
  const rooms = await orm.findMany('Rooms', { hotelId: hotel.id }) as any[]
  let available = rooms.filter((r: any) => r.status === 'disponible' || r.status === 'available')

  // Disponibilidad real por fechas: excluir rooms con reserva solapada (evita overbooking).
  if (q.checkIn && q.checkOut) {
    const hotelRes = await orm.findMany('Reservations', { hotelId: hotel.id }) as any[]
    const overlap = new Set(hotelRes
      .filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < q.checkOut && r.checkOut > q.checkIn)
      .map((r: any) => r.roomId))
    available = available.filter((r: any) => !overlap.has(r.id))
  }

  // Amenidades por room (de room_amenities) para mostrarlas en el motor.
  const roomIds = new Set(rooms.map((r: any) => r.id))
  const amsRaw = ((await orm.findMany('RoomAmenities', {})) as any[]).filter((a) => roomIds.has(a.roomId) && a.isActive !== false)
  const amsByRoom = new Map<string, string[]>()
  for (const a of amsRaw) {
    if (!amsByRoom.has(a.roomId)) amsByRoom.set(a.roomId, [])
    amsByRoom.get(a.roomId)!.push(a.amenityKey)
  }

  const byType = new Map<string, any[]>()
  for (const r of available) {
    const key = r.type || 'standard'
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push({ id: r.id, number: r.number, name: r.name, basePrice: r.basePrice, capacity: r.capacity })
  }
  const roomTypes = Array.from(byType.entries()).map(([type, items]) => ({
    type, count: items.length, price: items[0].basePrice, rooms: items,
    amenities: amsByRoom.get(items[0].id) || [],
  }))
  return { status: 200, body: { hotel: { id: hotel.id, name: hotel.name, slug: hotel.name?.toLowerCase().replace(/\s+/g, '-') }, roomTypes } }
})

router.post('/api/public/booking', async (req) => {
  const { hotelId, roomId, guestName, guestEmail, guestPhone, checkIn, checkOut, adults, children: kids } = req.body as any
  if (!hotelId || !roomId || !guestName || !guestEmail || !checkIn || !checkOut) {
    return { status: 400, body: { error: 'Campos requeridos: hotelId, roomId, guestName, guestEmail, checkIn, checkOut' } }
  }
  if (checkIn >= checkOut) return { status: 400, body: { error: 'checkIn debe ser anterior a checkOut' } }
  const room = await orm.findById('Rooms', roomId) as any
  if (!room) return { status: 404, body: { error: 'Habitación no encontrada' } }

  // Validar disponibilidad real: rechazar si hay reserva solapada (evita overbooking).
  const overlapping = (await orm.findMany('Reservations', { roomId })) as any[]
  const hasOverlap = overlapping.some((r: any) =>
    r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < checkOut && r.checkOut > checkIn)
  if (hasOverlap) return { status: 409, body: { error: 'Habitación no disponible en esas fechas' } }

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  const totalAmount = (room.basePrice || 0) * nights
  const guest = await orm.create('Guests', {
    id: crypto.randomUUID(), hotelId, name: guestName, email: guestEmail, phone: guestPhone || '',
    documentType: 'passport', documentNumber: '', nationality: '', address: '',
  })
  const reservation = await orm.create('Reservations', {
    id: crypto.randomUUID(), hotelId, roomId, guestId: guest.id,
    checkIn, checkOut, status: 'pending', source: 'direct',
    adults: adults || 1, children: kids || 0, totalAmount, deposit: 0,
    notes: 'Reserva desde widget público',
  })

  // Recalcular availability en Channex (la room pasa a tener una reserva vigente).
  pushAvailabilityToChannex(hotelId, roomId)

  return { status: 201, body: { reservation, guest } }
})



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

// Post-init: las reservas creadas por la IA bypassan el módulo reservas (no emiten sockets).
// Inyectamos el mismo pusher en ai-recepcionista para que la availability en Channex quede sincronizada.
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

// ── Auto PaymentRequest al crear reserva (toggle Settings > Automatización > autoPaymentRequest) ──
// Cross-module vía socket onReservasCreated: el módulo reservas NO importa PaymentRequests (regla
// de arquitectura). composition-root orquesta. Fire-and-forget: si falla, NO rompe la creación.
// Idempotente: no duplica si ya existe un PR pendiente para la reserva.
const reservasSvc = reservasForEmail as any
if (reservasSvc && typeof reservasSvc.setSockets === 'function') {
  // D7 — Audit trail: registra eventos de reservas en AuditLog. Fire-and-forget (no bloquea).
  // El actor es 'system' para el CRUD del módulo (el socket no recibe req.user); el check-in/out
  // (handlers en composition-root) sí loguean el userId real. Mejora futura: pasar actor al socket.
  const audit = (action: string, id: string, hotelId: string | null, snap: any) => {
    // Modelo 'Auditlog' del módulo auditlog (campos: userId/userName/detail). No 'AuditLog'.
    // userId SIEMPRE null: el socket actúa como 'system' (no hay req.user); la FK userId→users
    // exige un id real o NULL → 'system' violaba la constraint. userName identifica el origen.
    // hotelId null si no se conoce (delete físico) — la FK hotelId→hotels también exige real o NULL.
    orm.create('Auditlog', {
      id: crypto.randomUUID(), hotelId: hotelId || null, entity: 'Reservations', entityId: id, action,
      userId: null, userName: 'system (auto)', detail: snap ? JSON.stringify(snap) : null,
    }).catch((e: any) => logger.warn('audit log falló', { action, id, error: (e as Error).message }))
  }

  reservasSvc.setSockets({
    onReservasCreated: async (r: any) => {
      audit('create', r.id, r.hotelId, { status: r.status, totalAmount: r.totalAmount, roomId: r.roomId })
      try {
        const cfg = (await orm.findMany('Configuration', { hotelId: r.hotelId, key: 'automation_config' }))[0] as any
        const auto = cfg ? safeParse(cfg.value) : {}
        if (!auto?.autoPaymentRequest) return
        const pending = Math.max(0, Number(r.totalAmount || 0) - Number(r.deposit || 0))
        if (pending <= 0) return
        const existing = await orm.findMany('PaymentRequests', { reservationId: r.id }) as any[]
        if (existing.some((p: any) => p.status === 'pending')) return
        await orm.create('PaymentRequests', {
          id: crypto.randomUUID(), hotelId: r.hotelId, reservationId: r.id,
          amount: pending, currency: r.currency || 'USD', status: 'pending', sentTo: '', sentVia: 'email',
        })
        logger.info('Auto PaymentRequest creado (automation_config.autoPaymentRequest)', { reservationId: r.id, amount: pending })
      } catch (e) {
        logger.warn('auto payment request falló (no bloquea la reserva)', { reservationId: r.id, error: (e as Error).message })
      }
    },
    onReservasUpdated: async (r: any) => {
      audit('update', r.id, r.hotelId, { status: r.status, totalAmount: r.totalAmount })
    },
    onReservasDeleted: async (id: string) => {
      // onDelete solo recibe id (sin hotelId) → audit mínimo. hotelId null (FK real-o-NULL).
      audit('delete', id, null, null)
    },
  })
}
await emailService.reclaimStale()
setInterval(() => {
  emailService.processQueue().catch((e) => logger.error('email worker tick', { error: (e as Error).message }))
  // Recupera filas 'processing' de workers muertos en runtime (no solo al arranque).
  emailService.reclaimStale().catch((e) => logger.error('email worker reclaim', { error: (e as Error).message }))
}, EMAIL_WORKER_TICK_MS)
logger.info('EmailService worker listo', { tickMs: EMAIL_WORKER_TICK_MS })

// ─── Auto-Messages Cron Job (cada hora) ─────────────────────────────────────
// Verifica si hay auto-messages activos que deban enviarse para reservas próximas.
const AUTO_MESSAGES_TICK_MS = 60_000 * 60 // 1 hora
const autoMsgTrigger = system.resolveModule<{ triggerAutoMessages: (params: any) => Promise<void> }>('marketing')
if (autoMsgTrigger) {
  const processAutoMessages = async () => {
    try {
      // Buscar reservas que checkean hoy o en los próximos días
      const today = new Date()
      const hotels = await orm.findMany('Hotels', {}) as any[]

      for (const hotel of hotels) {
        // checkin_day: reservas que checkean hoy
        const checkinToday = await orm.findMany('Reservations', {
          hotelId: hotel.id,
          checkIn: today.toISOString().split('T')[0],
          status: 'confirmed',
        }) as any[]

        for (const r of checkinToday) {
          await autoMsgTrigger.triggerAutoMessages({
            hotelId: hotel.id,
            event: 'checkin_day',
            reservationId: r.id,
            guestId: r.guestId,
            roomId: r.roomId,
            variables: {
              checkin_date: r.checkIn,
              checkout_date: r.checkOut,
              locator: r.externalLocator || r.id.slice(-8),
            },
          })
        }

        // checkout_day: reservas que hacen checkout hoy
        const checkoutToday = await orm.findMany('Reservations', {
          hotelId: hotel.id,
          checkOut: today.toISOString().split('T')[0],
          status: 'checked_in',
        }) as any[]

        for (const r of checkoutToday) {
          await autoMsgTrigger.triggerAutoMessages({
            hotelId: hotel.id,
            event: 'checkout_day',
            reservationId: r.id,
            guestId: r.guestId,
            roomId: r.roomId,
            variables: {
              checkin_date: r.checkIn,
              checkout_date: r.checkOut,
              locator: r.externalLocator || r.id.slice(-8),
            },
          })
        }
      }
    } catch (e) {
      logger.warn('auto-messages cron failed', { error: (e as Error).message })
    }
  }

  setInterval(processAutoMessages, AUTO_MESSAGES_TICK_MS)
  logger.info('Auto-messages cron listo', { tickMs: AUTO_MESSAGES_TICK_MS })
}

process.on('SIGINT', async () => { await system.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await system.stop(); process.exit(0) })
