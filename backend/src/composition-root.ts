// src/composition-root.ts — ManagerHotel / SOLMI OS
// Entry point con arckode-framework. Estructura canónica: System → módulos → start.

import {
  System, ConfigStore, Logger, Router, MemoryCache, ORM, Container, OrmRepository, NodeServer,
} from 'arckode-framework'
import { cors } from 'arckode-framework/middlewares'
import { validateSchema } from 'arckode-framework'
import type { ValidationRule } from 'arckode-framework'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { HotelAuth } from './infrastructure/auth/hotel-auth'
import { EmailService } from './services/email-service'
import type { EmailQueueDTO } from './services/email-service'
import { NotificationRenderer, type AutoMessageTemplateRow } from './services/notification-renderer'
import type { EmailSender } from './services/email-sender'
import { sendCheckinEmail } from './modules/reservas/usecases/checkin-email'
import { dispatchLifecycleEmail } from './modules/reservas/usecases/lifecycle-email'
import { hashGuaranteePin, verifyGuaranteePin } from './services/guarantee-pin'
import { getAccessToken, listLocks, addKeyboardPassword, randomPin } from './services/ttlock-client'
import { registerSharedModels } from './shared/models'

// ─── Rate limiter in-memory para endpoints públicos ───────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip)
  }
}, 300_000)

// ─── PreCheckin validation schema ─────────────────────────────────────────
const PreCheckinSchema: Record<string, ValidationRule> = {
  guestName: { type: 'string' as const, min: 2 },
  email: { type: 'string' as const },
  phone: { type: 'string' as const, max: 30 },
  documentType: { type: 'string' as const, enum: ['dni', 'passport', 'other'] },
  documentNumber: { type: 'string' as const, min: 5, max: 50 },
  nationality: { type: 'string' as const, min: 2, max: 2 },
  birthDate: { type: 'string' as const, pattern: /^\d{4}-\d{2}-\d{2}$/ },
}

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
import type { FoliosService } from './modules/folios'
import { taxRateFor } from './modules/folios/usecases/folio-math'
import type { FacturasService } from './modules/facturas'
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
]
for (const m of mods) system.addModule(m as any)

// ─── Conector: reservas → housekeeping (check-out dispara limpieza) ────────
import { reservasHousekeepingConnector } from './connectors/reservas-housekeeping'
system.addConnector('reservas-housekeeping', reservasHousekeepingConnector)

// ─── Conector: habitaciones → canales (cambio de precioBase → push tarifa Channex)
import { habitacionesCanalesConnector } from './connectors/habitaciones-canales'
system.addConnector('habitaciones-canales', habitacionesCanalesConnector)

// ─── Register extracted routes ───────────────────────────────────────────
registerAdminRoutes(router, orm, auth, logger)
registerReportRoutes(router, orm, auth)
registerSettingsRoutes(router, orm, auth)


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

router.get('/api/dashboard', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req); if (!id) return { status: 200, body: {} }
  const rooms = await orm.findMany('Rooms', { hotelId: id })
  const res = await orm.findMany('Reservations', { hotelId: id })
  const guests = await orm.findMany('Guests', { hotelId: id })
  const occupied = rooms.filter((r: any) => r.status === 'occupied').length
  const dirty = rooms.filter((r: any) => r.status === 'dirty').length
  const maintenance = rooms.filter((r: any) => r.status === 'out_of_service').length

  const t = today()
  const revenueToday = res.filter((r: any) => {
    const d = String(r.checkIn || '').slice(0, 10)
    return d === t
  }).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)

  const checkins = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && (r.status === 'confirmed' || r.status === 'checked_in')).length
  const checkouts = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === t && (r.status === 'checked_in' || r.status === 'checked_out')).length

  // Trend vs yesterday
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const occYesterday = rooms.length ? Math.round((rooms.filter((r: any) => r.status === 'occupied').length / rooms.length) * 100) : 0
  const revYesterday = res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === yesterday).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
  const occToday = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0
  const occTrend = occToday > occYesterday ? 'up' : occToday < occYesterday ? 'down' : 'stable'
  const revTrend = revenueToday > revYesterday ? 'up' : revenueToday < revYesterday ? 'down' : 'stable'

  return { status: 200, body: {
    ocupacion: occToday,
    revenue: res.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0),
    revenueToday,
    totalRooms: rooms.length, occupied, checkins, checkouts,
    huespedes: guests.length, reservas: res.length,
    dirty, maintenance,
    roomsByType: rooms.reduce((a: any, r: any) => ((a[r.type] = (a[r.type] || 0) + 1), a), {}),
    roomsByStatus: rooms.reduce((a: any, r: any) => ((a[r.status] = (a[r.status] || 0) + 1), a), {}),
    trends: {
      ocupacion: { value: occYesterday, direction: occTrend },
      revenue: { value: revYesterday, direction: revTrend },
    },
  } }
})

router.get('/api/planning', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 200, body: { rooms: [], reservas: [] } }
  const [rooms, reservas, guests] = await Promise.all([
    orm.findMany('Rooms', { hotelId: id }),
    orm.findMany('Reservations', { hotelId: id }),
    orm.findMany('Guests', { hotelId: id }),
  ])
  const guestMap = new Map((guests as any[]).map((g: any) => [g.id, g]))
  const roomMap = new Map((rooms as any[]).map((r: any) => [r.id, r]))
  const enriched = (reservas as any[]).map((r: any) => {
    const guest = guestMap.get(r.guestId)
    const room = roomMap.get(r.roomId)
    const deposit = Number(r.deposit) || 0
    const total = Number(r.totalAmount) || 0
    return {
      ...r,
      guestName: guest?.name || 'Guest',
      guestEmail: guest?.email || '',
      roomNumber: room?.number || '',
      paymentStatus: deposit >= total && total > 0 ? 'paid' : deposit > 0 ? 'partial' : 'pending',
    }
  })
  return { status: 200, body: { rooms, reservas: enriched } }
})
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

router.post('/api/night-audit/mark-no-shows', [auth.authenticate('hotel_admin', 'super_admin')], async () => {
  const marked = await markNoShows()
  return { status: 200, body: { success: true, marked } }
})

router.get('/api/night-audit', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]
  const res = await orm.findMany('Reservations', { hotelId: id }) as any[]
  const t = today()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const occupied = rooms.filter((r: any) => r.status === 'occupied').length
  const ocupacion = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0
  const revenueTotal = res.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
  const revenueHoy = res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === t).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
  const revenueServicios = res.reduce((s: number, r: any) => s + (r.deposit || 0), 0)
  const checkinsHoy = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && (r.status === 'confirmed' || r.status === 'checked_in')).length
  const checkoutsHoy = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === t && (r.status === 'checked_in' || r.status === 'checked_out')).length
  const noShows = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && r.status === 'pending').length
  const cancelaciones = res.filter((r: any) => r.status === 'cancelled').length
  // ADR/RevPAR basados en noches vendidas (no en ocupación actual): ADR = revenue / noches; RevPAR = ADR × ocupación.
  const nightsOf = (r: any) => {
    const a = new Date(String(r.checkIn).slice(0, 10)).getTime()
    const b = new Date(String(r.checkOut).slice(0, 10)).getTime()
    return a && b && b > a ? Math.round((b - a) / 86400000) : 0
  }
  const totalNightsSold = res.reduce((s: number, r: any) => s + nightsOf(r), 0)
  const adr = totalNightsSold > 0 ? Math.round(revenueTotal / totalNightsSold) : 0
  const revpar = Math.round(adr * (ocupacion / 100))
  const adrYesterday = occupied > 0 ? Math.round(res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === yesterday).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0) / Math.max(occupied, 1)) : 0
  // Tasa de impuesto desde la config fiscal del hotel (igual que el módulo de folios).
  const configRepo = new OrmRepository<any>(orm, 'Configuration')
  const taxRate = id ? await taxRateFor(configRepo, id) : 0
  return { status: 200, body: {
    fecha: t,
    ocupacion, habitacionesOcupadas: occupied, habitacionesTotales: rooms.length,
    ingresosHabitaciones: revenueHoy,
    ingresosServicios: revenueServicios,
    impuestos: Math.round(revenueHoy * taxRate),
    totalDia: revenueHoy + revenueServicios,
    checkins: checkinsHoy, checkouts: checkoutsHoy,
    noShows, cancelaciones,
    nochesVendidas: res.filter((r: any) => r.status === 'checked_in' || r.status === 'checked_out').length,
    adr, revpar,
    adrAyer: adrYesterday,
    pagosRecibidos: res.reduce((s: number, r: any) => s + (r.deposit || 0), 0),
    pagosPendientes: res.filter((r: any) => r.status !== 'cancelled').reduce((s: number, r: any) => s + Math.max(0, (r.totalAmount || 0) - (r.deposit || 0)), 0),
    depositos: res.filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + (r.deposit || 0), 0),
    reembolsos: 0,
  } }
})
// ─── Folios: cerrar folio → generar factura (cross-module) ─────────────────
router.post('/api/folios/:id/invoice', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const folios = system.resolveModule<FoliosService>('folios')
  const facturas = system.resolveModule<FacturasService>('facturas')
  const folio = await folios.close(req.params.id, req.user as any)
  const sum = await folios.summary(req.params.id)
  if (!sum) return { status: 404, body: { error: 'Folio no encontrado' } }
  const invoice = await facturas.create({
    hotelId: folio.hotelId, guestId: folio.guestId, reservationId: folio.reservationId,
    amount: sum.subtotal, type: 'invoice', dueDate: today(),
    notes: `Generada desde folio ${folio.id} · ${sum.total} total`,
  } as any, req.user as any)
  const linked = await folios.setInvoice(req.params.id, invoice.id, req.user as any)
  return { status: 201, body: { folio: linked, invoice, invoiceData: invoice } } // invoiceData: alias de compat con el frontend (V-08)
})

// ─── Night audit: postear tarifa de habitación a folios in-house ───────────
router.post('/api/folios/audit/post-room-charges', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
  const folios = system.resolveModule<FoliosService>('folios')
  const t = today()
  const reservations = await orm.findMany('Reservations', { hotelId: id }) as any[]
  const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]
  const roomById = new Map(rooms.map((r: any) => [r.id, r]))
  const inHouse = reservations.filter((r: any) =>
    r.status === 'checked_in' && r.checkIn && r.checkOut &&
    String(r.checkIn).slice(0, 10) <= t && t <= String(r.checkOut).slice(0, 10),
  )
  let posted = 0
  for (const res of inHouse) {
    const room = roomById.get(res.roomId)
    if (!room) continue
    let folio = (await folios.list({ reservationId: res.id, status: 'open' } as any, req.user as any)).data[0]
    if (!folio) folio = await folios.open({ hotelId: id, reservationId: res.id, guestId: res.guestId, roomId: res.roomId }, req.user as any)
    await folios.postCharge(folio.id, {
      description: `Habitación ${room.number} — ${t}`, category: 'room',
      amount: Number(room.basePrice) || 0, quantity: 1, source: 'night_audit',
    }, req.user as any)
    posted++
  }
  return { status: 200, body: { posted, date: t } }
})

router.get('/api/checkin', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const res = await orm.findMany('Reservations', { hotelId: id }) as any[]
  const guests = await orm.findMany('Guests', { hotelId: id })
  const rooms = await orm.findMany('Rooms', { hotelId: id })
  const guestMap = new Map(guests.map(g => [g.id, g]))
  const roomMap = new Map(rooms.map(r => [r.id, r]))
  const t = today()
  const checkins = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && ['confirmed', 'pending'].includes(r.status))
  const checkouts = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === t && (r.status === 'checked_in' || r.status === 'checked_out'))
  const enrich = (list: any[]) => list.map((r: any) => {
    const guest = guestMap.get(r.guestId)
    const room = roomMap.get(r.roomId)
    return { ...r, guestName: guest?.name || 'Guest', guestEmail: guest?.email || '', roomNumber: room?.number || '' }
  })
  return { status: 200, body: { checkins: enrich(checkins), checkouts: enrich(checkouts), pendingCheckins: checkins.length, todayCheckouts: checkouts.length } }
})

// ─── Check-in / Check-out REALES de reserva ───────────────────────────
// Orquesta: reserva (status + timestamps) + habitación + folio + huésped.
// Envuelto en transacción SQLite para atomicidad (spec 12.1.1).
router.post('/api/reservas/:id/checkin', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hotelId = await hotelOf(req)
  const userId = (req.user as any).id

  // Validación pre-transacción
  const r = (await orm.findMany('Reservations', { id: req.params.id }))[0] as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  if ((req.user as any).role !== 'super_admin' && r.hotelId !== hotelId) {
    return { status: 403, body: { error: 'No autorizado' } }
  }
  if (r.status === 'checked_in') return { status: 409, body: { error: 'La reserva ya tiene check-in' } }
  if (!['confirmed', 'pending'].includes(r.status)) {
    return { status: 409, body: { error: `No se puede hacer check-in de una reserva ${r.status}` } }
  }

  const nowIso = new Date().toISOString()
  let guestId = r.guestId
  let folioId = ''

  // ── Transacción: guest + folio + reserva + room ──
  try {
    await orm.transaction(async (tx) => {
      // 1) Huésped: walk-in o +1 estadía
      if (!guestId) {
        const guestName = r.externalLocator ? `Pasajero ${r.externalLocator}` : 'Pasajero walk-in'
        const guest = await tx.create('Guests', {
          id: crypto.randomUUID(), name: guestName, hotelId: r.hotelId, active: 1,
          totalStays: 1, totalSpent: 0, tier: 'bronze', notes: r.otaNotes || null,
        }) as any
        guestId = guest.id
      } else {
        const g = (await tx.findMany('Guests', { id: guestId }))[0] as any
        if (g) await tx.update('Guests', guestId, { totalStays: (Number(g.totalStays) || 0) + 1 })
      }

      // 2) Folio abierto
      folioId = crypto.randomUUID()
      await tx.create('Folios', {
        id: folioId, hotelId: r.hotelId, reservationId: r.id, guestId, roomId: r.roomId,
        status: 'open', currency: r.currency || 'USD', invoiceId: null, openedAt: nowIso, closedAt: null,
      })

      // 3) Reserva → checked_in
      await tx.update('Reservations', r.id, {
        status: 'checked_in', checkedInAt: nowIso, folioId, guestId,
      })

      // 4) Habitación → occupied
      await tx.update('Rooms', r.roomId, { status: 'occupied' })
    })
  } catch (e) {
    logger.error('check-in transaction failed', { reservationId: r.id, error: (e as Error).message })
    return { status: 500, body: { error: 'Error interno al procesar check-in' } }
  }

  // ── Fuera de transacción: side effects fire-and-forget ──
  // 5) AuditLog
  orm.create('Auditlog', {
    id: crypto.randomUUID(), entity: 'Reservations', entityId: r.id,
    action: 'checkin', userId, hotelId: r.hotelId,
    detail: JSON.stringify({ guestId, roomId: r.roomId, folioId, checkIn: r.checkIn, checkOut: r.checkOut }),
    createdAt: nowIso,
  }).catch((e) => logger.warn('auditlog checkin', { error: (e as Error).message }))

  // 6) Channex availability
  pushAvailabilityToChannex(r.hotelId, r.roomId)

  // 6.5) TTLock: generar PIN de puerta automáticamente al check-in si está habilitado.
  //       (DEUDA TÉCNICA: el envío del código al huésped por email/WA — hoy se guarda en LockCodes y se ve en el detalle).
  ;(async () => {
    try {
      const autoCfg = (await orm.findMany('Configuration', { hotelId: r.hotelId, key: 'automation_config' }))[0] as any
      const auto = autoCfg ? safeParse(autoCfg.value) : {}
      if (!auto?.autoLockCode) return
      const lock = (await orm.findMany('LockDevices', { roomId: r.roomId }))[0] as any
      if (!lock?.ttlockLockId) return
      const tcfg = (await orm.findMany('Configuration', { hotelId: r.hotelId, key: 'ttlock_config' }))[0] as any
      const tp = tcfg ? safeParse(tcfg.value) : {}
      if (!tp?.accessToken) return
      const password = randomPin()
      const startMs = new Date(r.checkIn).getTime()
      const endMs = new Date(r.checkOut).getTime()
      const { keyboardPwdId } = await addKeyboardPassword({ clientId: tp.clientId, accessToken: tp.accessToken, region: tp.region }, Number(lock.ttlockLockId), password, startMs, endMs)
      await orm.create('LockCodes', { id: crypto.randomUUID(), lockId: lock.id, reservationId: r.id, code: password, codeType: 'time', startDate: String(r.checkIn).slice(0, 10), endDate: String(r.checkOut).slice(0, 10), status: 'active', ttlockKeyboardPwdId: keyboardPwdId || '', sentVia: 'auto-checkin' })
      logger.info('TTLock auto-generado al check-in', { reservationId: r.id, lockId: lock.ttlockLockId })
    } catch (e) { logger.warn('TTLock auto check-in falló (no bloquea el check-in)', { reservationId: r.id, error: (e as Error).message }) }
  })()

  // 7) Email de bienvenida
  await sendCheckinEmail(
    {
      emailSender: emailService,
      guestRepo: new OrmRepository<any>(orm, 'Guests'),
      roomRepo: new OrmRepository<any>(orm, 'Rooms'),
      hotelRepo: new OrmRepository<any>(orm, 'Hotels'),
      messageLogRepo: new OrmRepository<any>(orm, 'MessageLogs'),
      logger,
    },
    { reservationId: r.id, hotelId: r.hotelId, guestId, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut },
  ).catch((e) => logger.warn('check-in email', { error: (e as Error).message }))

  return { status: 200, body: { ok: true, reservationId: r.id, status: 'checked_in', folioId, guestId } }
})

router.post('/api/reservas/:id/checkout', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hotelId = await hotelOf(req)
  const userId = (req.user as any).id

  const r = (await orm.findMany('Reservations', { id: req.params.id }))[0] as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  if ((req.user as any).role !== 'super_admin' && r.hotelId !== hotelId) {
    return { status: 403, body: { error: 'No autorizado' } }
  }
  if (r.status !== 'checked_in') {
    return { status: 409, body: { error: `Solo se puede hacer check-out de una reserva con check-in (actual: ${r.status})` } }
  }

  const nowIso = new Date().toISOString()

  // ── Transacción: reserva + room + housekeeping ──
  // NOTA (F1.1): esta creación directa NO duplica la del connector reservas-housekeeping.
  // El connector escucha `onReservasUpdated`, que solo emite reservas/service.ts (update()).
  // Este endpoint hace tx.update directo sobre Reservations → el connector NO recibe el
  // evento checkout → esta transacción es el ÚNICO creador de la tarea al hacer check-out.
  // El connector cubre updates de reserva que sí pasan por el service. No eliminar de acá.
  try {
    await orm.transaction(async (tx) => {
      await tx.update('Reservations', r.id, { status: 'checked_out', checkedOutAt: nowIso })
      await tx.update('Rooms', r.roomId, { status: 'cleaning' })
      await tx.create('Housekeeping', {
        id: crypto.randomUUID(), roomId: r.roomId, hotelId: r.hotelId,
        type: 'full_cleaning', priority: 'high', status: 'pending',
      })
    })
  } catch (e) {
    logger.error('check-out transaction failed', { reservationId: r.id, error: (e as Error).message })
    return { status: 500, body: { error: 'Error interno al procesar check-out' } }
  }

  // B3 — Invalidar cache de lista de housekeeping: el checkout crea la tarea con tx.create
  // directo (no pasa por el service) → el cache housekeeping:list:* quedaría stale hasta 300s.
  const housekeepingMod = system.resolveModule<{ invalidateListCache?: (hotelId?: string) => Promise<void> }>('housekeeping')
  if (housekeepingMod?.invalidateListCache) {
    await housekeepingMod.invalidateListCache(r.hotelId).catch((e: unknown) =>
      logger.warn('housekeeping list cache invalidation after checkout', { error: (e as Error).message }),
    )
  }

  // ── Fuera de transacción ──
  // AuditLog
  orm.create('Auditlog', {
    id: crypto.randomUUID(), entity: 'Reservations', entityId: r.id,
    action: 'checkout', userId, hotelId: r.hotelId,
    detail: JSON.stringify({ roomId: r.roomId, guestId: r.guestId, checkIn: r.checkIn, checkOut: r.checkOut }),
    createdAt: nowIso,
  }).catch((e) => logger.warn('auditlog checkout', { error: (e as Error).message }))

  // Channex availability
  pushAvailabilityToChannex(r.hotelId, r.roomId)

  // D3 — email de checkout al huésped (fire-and-forget; no bloquea el check-out).
  dispatchLifecycleEmail(
    { emailSender: emailService, guestRepo: new OrmRepository<any>(orm, 'Guests'), roomRepo: new OrmRepository<any>(orm, 'Rooms'), hotelRepo: new OrmRepository<any>(orm, 'Hotels'), messageLogRepo: new OrmRepository<any>(orm, 'MessageLogs'), logger },
    { reservationId: r.id, hotelId: r.hotelId, guestId: r.guestId, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut, event: 'checkout' },
  ).catch((e) => logger.warn('checkout email', { reservationId: r.id, error: (e as Error).message }))

  // TTLock — auto-delete codes after checkout (mark as expired)
  const lockCodes = await orm.findMany('LockCodes', { reservationId: r.id }) as any[]
  for (const code of lockCodes) {
    if (code.status === 'active') {
      try {
        await orm.update('LockCodes', code.id, { status: 'expired' })
        logger.info('TTLock code auto-expired after checkout', { codeId: code.id, reservationId: r.id })
      } catch (e) {
        logger.warn('TTLock code expiry failed', { codeId: code.id, error: (e as Error).message })
      }
    }
  }

  return { status: 200, body: { ok: true, reservationId: r.id, status: 'checked_out' } }
})
router.get('/api/booking-engine', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const hotel = (await orm.findMany('Hotels', { id }))[0] as any
  const roomTypes = await orm.findMany('Rooms', { hotelId: id })
  const res = await orm.findMany('Reservations', { hotelId: id }) as any[]
  const directas = res.filter((r: any) => r.channel === 'direct' || r.channel === 'whatsapp').length
  const revenueDirecta = res.filter((r: any) => r.channel === 'direct' || r.channel === 'whatsapp').reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
  const totalReservas = res.length
  return { status: 200, body: { hotel, roomTypes, total: roomTypes.length, directas, revenueDirecta, totalReservas, comisionesAhorradas: Math.round(revenueDirecta * 0.15) } }
})
// /api/channels, /api/channels/feed, /api/channels/sync → módulo canales (Channex real)
router.get('/api/settings', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const hotel = (await orm.findMany('Hotels', { id }))[0] as any
  const rooms = await orm.findMany('Rooms', { hotelId: id })
  const seen = new Set<string>(); const baseRates: any[] = []
  for (const r of rooms as any[]) { if (!seen.has(r.type)) { seen.add(r.type); baseRates.push({ type: r.type, price: r.basePrice }) } }
  return { status: 200, body: { hotel, baseRates } }
})
router.put('/api/settings/hotel', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = (req.body as any).id || (await hotelOf(req))
  const body = req.body as any
  const safePatch: Record<string, any> = {}
  // Whitelist ampliada con todos los campos de MisterPlan (optimizada)
  const allowed = [
    'name','country','address','phone','email','timezone','currency','checkIn','checkOut','plan',
    'freeCancellation','depositRequired','depositPercent','weekendSurcharge',
    // Propietario
    'ownerName','ownerTaxId','deviceEmail',
    // Alojamiento
    'accommodationType','registrationNumber','website','bookingEngineUrl',
    'phone2','warningPhone','secondaryCurrency','youtubeUrl','starRating',
    'onlineBookingStatus','motorVersion',
    // Localización
    'latitude','longitude','province','municipality','locality','postalCode',
    // Condiciones
    'cleaningType','depositType','depositFixed','advanceType','advanceAmount',
    'releaseHours','defaultPaymentMethod',
    // Reseñas
    'requestReviews','publishReviewScore','publishReviewComments',
    // Impuestos
    'taxName','taxRate',
    // Multilingüe + WiFi
    'descriptionJson','wifiNetwork','wifiPassword',
  ]
  for (const k of allowed) { if (body[k] !== undefined) safePatch[k] = body[k] }
  await orm.update('Hotels', id, safePatch)
  return { status: 200, body: await orm.findById('Hotels', id) }
})
router.get('/api/configuracion/:key', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const row = (await orm.findMany('Configuration', { hotelId: id, key: req.params.key }))[0] as any
    || (await orm.findMany('Configuration', { hotelId: 'platform', key: req.params.key }))[0] as any
  return { status: 200, body: { valor: row ? safeParse(row.value) : null } }
})
router.post('/api/configuracion', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const body = req.body as any
  const { clave, valor, hotelId } = body
  if (!clave || valor === undefined) return { status: 400, body: { error: 'clave y valor requeridos' } }
  const existing = (await orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: clave }))[0] as any
  const val = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  if (existing) {
    await orm.update('Configuration', existing.id, { value: val })
  } else {
    await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: hotelId || 'platform', key: clave, value: val })
  }
  return { status: 200, body: { success: true } }
})

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

// ═══════════════════════════════════════════════════════════════════════════
// Endpoints Fase 1 — Amenities, Seasons, Rates, Blocks
// ═══════════════════════════════════════════════════════════════════════════

// ─── Amenities ─────────────────────────────────────────────────────────────
// Catálogo curado (~30 amenities modernas, no las 100+ rurales de MisterPlan)
router.get('/api/amenities/catalog', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async () => {
  const catalog = {
    interior: [
      'ac', 'heating', 'kitchen', 'microwave', 'fridge', 'coffee_maker', 'washer', 'dishwasher',
      'tv', 'wifi', 'safe', 'minibar', 'hair_dryer', 'iron', 'balcony', 'bathtub', 'work_desk',
    ],
    exterior: [
      'pool', 'pool_heated', 'parking_free', 'parking_paid', 'gym', 'spa', 'restaurant', 'bar',
      'garden', 'terrace', 'bbq', 'elevator', 'lounge', 'kids_playground',
    ],
    services: ['room_service', 'laundry', 'concierge', 'luggage_storage', 'pets_allowed', 'wheelchair_access'],
  }
  return { status: 200, body: catalog }
})

// Amenities del hotel (globales)
router.get('/api/amenities/hotel', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const data = await orm.findMany('HotelAmenities', { hotelId: id, isActive: 1 }) as any[]
  return { status: 200, body: { data } }
})

router.put('/api/amenities/hotel', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const { amenities } = req.body as any
  if (!Array.isArray(amenities)) return { status: 400, body: { error: 'amenities debe ser un array' } }
  // Desactivar todas las actuales
  const existing = await orm.findMany('HotelAmenities', { hotelId: id }) as any[]
  for (const ex of existing) {
    if (!amenities.includes(ex.amenityKey)) {
      await orm.update('HotelAmenities', ex.id, { isActive: 0 })
    }
  }
  // Activar/crear las nuevas
  for (const key of amenities) {
    const found = existing.find(e => e.amenityKey === key)
    if (found) {
      await orm.update('HotelAmenities', found.id, { isActive: 1 })
    } else {
      const cat = key.includes('pool') || key.includes('parking') || key.includes('gym') || key.includes('spa') || key.includes('restaurant') || key.includes('bar') || key.includes('garden') || key.includes('terrace') || key.includes('bbq') || key.includes('kids') ? 'exterior'
        : key.includes('service') || key.includes('laundry') || key.includes('concierge') || key.includes('pets') || key.includes('wheelchair') ? 'services' : 'interior'
      await orm.create('HotelAmenities', { id: crypto.randomUUID(), hotelId: id, amenityKey: key, amenityCategory: cat, isActive: 1 })
    }
  }
  return { status: 200, body: { success: true, count: amenities.length } }
})

// Amenities de una habitación específica
router.get('/api/amenities/room/:roomId', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const data = await orm.findMany('RoomAmenities', { roomId: req.params.roomId, isActive: 1 }) as any[]
  return { status: 200, body: { data } }
})

router.put('/api/amenities/room/:roomId', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const { amenities } = req.body as any
  if (!Array.isArray(amenities)) return { status: 400, body: { error: 'amenities debe ser un array' } }
  const existing = await orm.findMany('RoomAmenities', { roomId: req.params.roomId }) as any[]
  for (const ex of existing) {
    if (!amenities.includes(ex.amenityKey)) await orm.update('RoomAmenities', ex.id, { isActive: 0 })
  }
  for (const key of amenities) {
    const found = existing.find(e => e.amenityKey === key)
    if (found) {
      await orm.update('RoomAmenities', found.id, { isActive: 1 })
    } else {
      await orm.create('RoomAmenities', { id: crypto.randomUUID(), roomId: req.params.roomId, amenityKey: key, isShared: 0, isActive: 1 })
    }
  }
  return { status: 200, body: { success: true, count: amenities.length } }
})

// ─── Seasons (Baja, Media, Alta, Especial) ─────────────────────────────────
router.get('/api/seasons', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const data = await orm.findMany('Seasons', { hotelId: id }) as any[]
  return { status: 200, body: { data: data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) } }
})

router.put('/api/seasons', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const { seasons } = req.body as any
  if (!Array.isArray(seasons)) return { status: 400, body: { error: 'seasons debe ser un array' } }
  // Limpiar existentes y crear nuevas (approach simple)
  const existing = await orm.findMany('Seasons', { hotelId: id }) as any[]
  for (const ex of existing) await orm.delete('Seasons', ex.id)
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i]
    await orm.create('Seasons', {
      id: crypto.randomUUID(), hotelId: id,
      name: s.name || `season-${i}`, label: s.label || '', 
      startDate: s.startDate || '', endDate: s.endDate || '',
      color: s.color || '#3b82f6', sortOrder: i,
    })
  }
  return { status: 200, body: { success: true, count: seasons.length } }
})

// ─── Rates (matriz tipo × ocupación × temporada) ───────────────────────────
router.get('/api/rates', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const data = await orm.findMany('RoomRates', { hotelId: id }) as any[]
  return { status: 200, body: { data } }
})

router.put('/api/rates', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const { rates } = req.body as any
  if (!Array.isArray(rates)) return { status: 400, body: { error: 'rates debe ser un array' } }
  let saved = 0
  for (const r of rates) {
    if (!r.roomType || !r.season || r.occupancy === undefined || r.price === undefined) continue
    const existing = (await orm.findMany('RoomRates', { hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: r.season }))[0] as any
    if (existing) {
      await orm.update('RoomRates', existing.id, { price: r.price })
    } else {
      await orm.create('RoomRates', { id: crypto.randomUUID(), hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: r.season, price: r.price })
    }
    saved++
  }
  return { status: 200, body: { success: true, count: saved } }
})

// ─── Room Blocks (bloqueos de planning) ────────────────────────────────────
router.get('/api/blocks', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const { startDate, endDate } = req.query as any
  let query: any = { hotelId: id }
  const data = await orm.findMany('RoomBlocks', query) as any[]
  // Filtrar por rango de fechas si se proporciona
  const filtered = startDate && endDate
    ? data.filter(b => b.startDate <= endDate && b.endDate >= startDate)
    : data
  return { status: 200, body: { data: filtered } }
})

router.post('/api/blocks', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const { roomIds, reason, startDate, endDate } = req.body as any
  if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) return { status: 400, body: { error: 'roomIds requerido' } }
  if (!startDate || !endDate) return { status: 400, body: { error: 'startDate y endDate requeridos' } }
  const created: any[] = []
  for (const roomId of roomIds) {
    const block = await orm.create('RoomBlocks', {
      id: crypto.randomUUID(), hotelId: id, roomId,
      reason: reason || '', startDate, endDate, createdBy: (req.user as any)?.id || '',
    })
    created.push(block)
  }

  // Recalcular availability en Channex (los bloqueos reducen disponibilidad esos días).
  if (id) for (const roomId of roomIds) pushAvailabilityToChannex(id, String(roomId))

  return { status: 201, body: { data: created, count: created.length } }
})

router.delete('/api/blocks/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const block = (await orm.findMany('RoomBlocks', { id: req.params.id }))[0] as any
  await orm.delete('RoomBlocks', req.params.id)
  // Recalcular availability en Channex (el bloqueo liberaba noches — vuelven a venderse).
  if (block) pushAvailabilityToChannex(block.hotelId, block.roomId)
  return { status: 200, body: { success: true } }
})

// ─── Pre-checkin público (sin auth) ──────────────────────────────────────
router.get('/api/public/pre-checkin/:hash', async (req) => {
  const ip = (req as any).ip || (req as any).socket?.remoteAddress || 'unknown'
  if (!checkRateLimit(ip)) return { status: 429, body: { success: false, error: { message: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' } } }

  const hash = req.params.hash
  const reservas = await orm.findMany('Reservations', {}) as any[]
  const reservation = reservas.find((r: any) => {
    const h = String(r.id).replace(/-/g, '').slice(0, 12)
    return h === hash || r.id === hash
  })
  if (!reservation) return { status: 404, body: { success: false, error: { message: 'Reserva no encontrada' } } }

  // Expiry check: no retornar reservas expiradas (12.3.3)
  const today = new Date().toISOString().split('T')[0]
  if (reservation.checkOut && String(reservation.checkOut).slice(0, 10) < today) {
    return { status: 410, body: { success: false, error: { message: 'Esta reserva ya expiró' } } }
  }

  const hotel = (await orm.findMany('Hotels', { id: reservation.hotelId }))[0] as any
  const room = (await orm.findMany('Rooms', { id: reservation.roomId }))[0] as any
  const guest = reservation.guestId ? (await orm.findById('Guests', reservation.guestId)) as any : null
  return { status: 200, body: {
    id: reservation.id, reservationId: reservation.id, hash,
    hotelName: hotel?.name || '', roomNumber: room?.number || '',
    checkIn: reservation.checkIn, checkOut: reservation.checkOut,
    guestName: guest?.name || '', email: guest?.email || '',
  } }
})

router.post('/api/public/pre-checkin/:hash', async (req) => {
  const ip = (req as any).ip || (req as any).socket?.remoteAddress || 'unknown'
  if (!checkRateLimit(ip)) return { status: 429, body: { success: false, error: { message: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' } } }

  const hash = req.params.hash
  const body = req.body as any

  // Validación de inputs (12.3.2)
  try {
    validateSchema(PreCheckinSchema, body)
  } catch (e) {
    return { status: 400, body: { success: false, error: { message: `Datos inválidos: ${(e as Error).message}` } } }
  }

  const reservas = await orm.findMany('Reservations', {}) as any[]
  const reservation = reservas.find((r: any) => {
    const h = String(r.id).replace(/-/g, '').slice(0, 12)
    return h === hash || r.id === hash
  })
  if (!reservation) return { status: 404, body: { success: false, error: { message: 'Reserva no encontrada' } } }

  if (reservation.guestId) {
    await orm.update('Guests', reservation.guestId, {
      name: body.guestName || undefined,
      email: body.email || undefined,
      phone: body.phone || undefined,
      documentType: body.documentType || undefined,
      documentNumber: body.documentNumber || undefined,
      nationality: body.nationality || undefined,
      birthDate: body.birthDate || undefined,
    })
  }
  if (body.companions?.length) {
    for (const c of body.companions) {
      await orm.create('Companions', {
        id: crypto.randomUUID(), reservationId: reservation.id,
        name: c.name, documentNumber: c.documentNumber || '',
      })
    }
  }
  return { status: 200, body: { success: true, message: 'Pre-checkin completado' } }
})

// ─── TTLock: Config y sincronización ─────────────────────────────────
router.put('/api/ttlock/config', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const body = req.body as any
  const cfg = await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }) as any[]
  const prev = cfg[0] ? safeParse(cfg[0].value) : {}
  // Conserva secretos si el body los envía vacíos (no precarga secretos en el form → no los sobrescribe con '').
  const keep = (k: string): string => (body[k] === undefined || body[k] === '') ? (prev[k] ?? '') : body[k]
  const value = JSON.stringify({
    clientId: keep('clientId'),
    clientSecret: keep('clientSecret'),
    username: keep('username'),
    password: keep('password'),
    region: body.region ?? prev.region ?? 'eu',
    accountId: body.accountId ?? prev.accountId ?? '',
    accessToken: keep('accessToken'),
    refreshToken: keep('refreshToken'),
  })
  if (cfg.length > 0) { await orm.update('Configuration', cfg[0].id, { value }) }
  else { await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: id, key: 'ttlock_config', value }) }
  return { status: 200, body: { success: true } }
})

router.get('/api/ttlock/config', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const cfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
  const parsed = cfg ? safeParse(cfg.value) : {}
  // No se exponen secretos (clientSecret, password, accessToken) al frontend.
  return { status: 200, body: {
    clientId: parsed?.clientId || '',
    username: parsed?.username || '',
    region: parsed?.region || 'eu',
    accountId: parsed?.accountId || '',
    configured: !!(parsed?.clientId && parsed?.clientSecret),
    connected: !!parsed?.accessToken,
  } }
})

// OAuth2 Resource Owner Password: clientId/clientSecret + username/password → access_token.
router.post('/api/ttlock/connect', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const cfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
  const prev = cfg ? safeParse(cfg.value) : {}
  const body = req.body as any
  const creds = {
    clientId: body.clientId || prev.clientId,
    clientSecret: body.clientSecret || prev.clientSecret,
    username: body.username || prev.username,
    password: body.password || prev.password,
    region: body.region || prev.region || 'eu',
  }
  let tokens: { accessToken: string; refreshToken?: string }
  try {
    tokens = await getAccessToken(creds)
  } catch (e) {
    return { status: 502, body: { error: (e as Error).message || 'No se pudo conectar con TTLock' } }
  }
  const value = JSON.stringify({ ...prev, ...creds, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken || prev.refreshToken })
  if (cfg) await orm.update('Configuration', cfg.id, { value })
  else await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: id, key: 'ttlock_config', value })
  return { status: 200, body: { success: true, connected: true } }
})

router.get('/api/ttlock/locks', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const locks = await orm.findMany('LockDevices', { hotelId: id }) as any[]
  const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]
  const roomMap = new Map(rooms.map((r: any) => [r.id, r]))
  const enriched = locks.map(l => ({ ...l, roomNumber: roomMap.get(l.roomId)?.number || '—' }))
  return { status: 200, body: { data: enriched } }
})

router.post('/api/ttlock/sync', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const cfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
  const parsed = cfg ? safeParse(cfg.value) : {}
  if (!parsed?.clientId) return { status: 400, body: { error: 'TTLock no configurado' } }
  if (!parsed?.accessToken) return { status: 400, body: { error: 'TTLock no conectado (falta autorizar)' } }
  let locks: Awaited<ReturnType<typeof listLocks>> = []
  try {
    locks = await listLocks({ clientId: parsed.clientId, accessToken: parsed.accessToken, region: parsed.region })
  } catch (e) {
    return { status: 502, body: { error: (e as Error).message || 'No se pudo sincronizar con TTLock' } }
  }
  const existing = (await orm.findMany('LockDevices', { hotelId: id })) as any[]
  const byTtlock = new Map(existing.filter((l) => l.ttlockLockId).map((l) => [String(l.ttlockLockId), l]))
  let synced = 0
  for (const l of locks) {
    const ttlockId = String(l.lockId)
    const data = {
      name: l.lockAlias || l.lockName || `Cerradura ${ttlockId}`,
      mac: l.lockMac || '',
      batteryLevel: Number(l.electricQuantity ?? 0),
      status: 'online',
    }
    const ex = byTtlock.get(ttlockId)
    if (ex) await orm.update('LockDevices', ex.id, data)
    else await orm.create('LockDevices', { id: crypto.randomUUID(), hotelId: id, ttlockLockId: ttlockId, roomId: '', ...data })
    synced++
  }
  return { status: 200, body: { success: true, synced, message: `${synced} cerradura(s) sincronizada(s)` } }
})

router.post('/api/ttlock/generate-code/:reservationId', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const hid = await hotelOf(req)
  if (!hid) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const { reservationId } = req.params
  const res = await orm.findById('Reservations', reservationId) as any
  if (!res) return { status: 404, body: { error: 'Reserva no encontrada' } }
  if (res.hotelId !== hid) return { status: 403, body: { error: 'Sin acceso a esta reserva' } }
  const lock = (await orm.findMany('LockDevices', { roomId: res.roomId }))[0] as any
  if (!lock?.ttlockLockId) return { status: 400, body: { error: 'La habitación no tiene cerradura TTLock mapeada' } }
  const cfg = (await orm.findMany('Configuration', { hotelId: hid, key: 'ttlock_config' }))[0] as any
  const parsed = cfg ? safeParse(cfg.value) : {}
  if (!parsed?.accessToken) return { status: 400, body: { error: 'TTLock no conectado (falta autorizar)' } }
  const creds = { clientId: parsed.clientId, clientSecret: parsed.clientSecret, accessToken: parsed.accessToken, region: parsed.region }
  const password = randomPin()
  const startMs = new Date(res.checkIn).getTime()
  const endMs = new Date(res.checkOut).getTime()
  let pwdId = ''
  try {
    const r = await addKeyboardPassword(creds, Number(lock.ttlockLockId), password, startMs, endMs)
    pwdId = r.keyboardPwdId || ''
  } catch (e) {
    return { status: 502, body: { error: (e as Error).message || 'No se pudo crear el PIN en la cerradura' } }
  }
  const codeEntry = await orm.create('LockCodes', {
    id: crypto.randomUUID(), lockId: lock.id, reservationId,
    code: password, codeType: 'time',
    startDate: String(res.checkIn).slice(0, 10), endDate: String(res.checkOut).slice(0, 10),
    status: 'active', ttlockKeyboardPwdId: pwdId, sentVia: '',
  })
  return { status: 201, body: codeEntry }
})

router.delete('/api/ttlock/code/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  await orm.update('LockCodes', req.params.id, { status: 'revoked' })
  return { status: 200, body: { success: true } }
})

router.put('/api/ttlock/lock/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const body = req.body as any
  const patch: Record<string, any> = {}
  if (body.roomId !== undefined) patch.roomId = body.roomId
  if (body.name !== undefined) patch.name = body.name
  await orm.update('LockDevices', req.params.id, patch)
  return { status: 200, body: await orm.findById('LockDevices', req.params.id) }
})

// ─── Caja: ahora es módulo canónico (src/modules/cash/) ──────────────
// Endpoints: /api/caja/movements, /api/caja/shifts, /api/caja/stats (+ conector payments→caja).
// El blob configuration.caja_movements se migra a cash_movements via scripts/migrate-caja-blob.ts.

// ═══════════════════════════════════════════════════════════════════════════
// Endpoints Fase 1 — Completos (settings/full, rates copy, companions, payments, whatsapp, reservations/:id)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /api/settings/full — Todos los datos del hotel en una sola llamada ─
router.get('/api/settings/full', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req); if (!id) return { status: 404, body: { error: 'Sin hotel' } }
  const hotel = (await orm.findById('Hotels', id)) as any
  const [amenities, seasons, rates, blocks, autoMessages] = await Promise.all([
    orm.findMany('HotelAmenities', { hotelId: id, isActive: 1 }) as Promise<any[]>,
    orm.findMany('Seasons', { hotelId: id }) as Promise<any[]>,
    orm.findMany('RoomRates', { hotelId: id }) as Promise<any[]>,
    orm.findMany('RoomBlocks', { hotelId: id }) as Promise<any[]>,
    system.resolveModule<{ listAutoMessages: (h: string) => Promise<any[]> }>('marketing')?.listAutoMessages(id) ?? Promise.resolve([]),
  ])
  const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]
  const roomTypes = [...new Set(rooms.map((r: any) => r.type || 'standard'))]
  const ttlockCfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
  const ttlock = ttlockCfg ? safeParse(ttlockCfg.value) : {}
  return { status: 200, body: {
    hotel,
    amenities: amenities.map(a => a.amenityKey),
    seasons: seasons.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    rates,
    blocks,
    autoMessages,
    roomTypes,
    ttlock: { ...ttlock, configured: !!(ttlock?.clientId && ttlock?.clientSecret) },
  } }
})

// ─── POST /api/rates/copy-next-year — Copia tarifas al próximo año ──────────
router.post('/api/rates/copy-next-year', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const rates = await orm.findMany('RoomRates', { hotelId: id }) as any[]
  let copied = 0
  for (const r of rates) {
    const nextYear = String(r.season || '').replace(/\d{4}/, String(new Date().getFullYear() + 1))
    const exists = (await orm.findMany('RoomRates', { hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: nextYear }))[0]
    if (!exists) {
      await orm.create('RoomRates', { id: crypto.randomUUID(), hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: nextYear, price: r.price })
      copied++
    }
  }
  return { status: 200, body: { success: true, copied, total: rates.length } }
})

// ─── Companions — CRUD standalone por reserva ───────────────────────────────
router.get('/api/reservations/:id/companions', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const data = await orm.findMany('Companions', { reservationId: req.params.id }) as any[]
  return { status: 200, body: { data } }
})

router.post('/api/reservations/:id/companions', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const body = req.body as any
  if (!body?.name) return { status: 400, body: { error: 'name requerido' } }
  const c = await orm.create('Companions', {
    id: crypto.randomUUID(), reservationId: req.params.id,
    name: body.name, documentType: body.documentType || 'passport',
    documentNumber: body.documentNumber || '', nationality: body.nationality || '',
    birthDate: body.birthDate || '', isMainGuest: body.isMainGuest ? 1 : 0,
  })
  return { status: 201, body: c }
})

router.put('/api/companions/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const body = req.body as any
  const patch: Record<string, any> = {}
  for (const k of ['name','documentType','documentNumber','nationality','birthDate']) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  if (body.isMainGuest !== undefined) patch.isMainGuest = body.isMainGuest ? 1 : 0
  await orm.update('Companions', req.params.id, patch)
  return { status: 200, body: await orm.findById('Companions', req.params.id) }
})

router.delete('/api/companions/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  await orm.delete('Companions', req.params.id)
  return { status: 200, body: { success: true } }
})

// ─── Reservation Addons — otros servicios y descuentos (F3 match-misterplan) ─
router.get('/api/reservations/:id/addons', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const data = await orm.findMany('ReservationAddons', { reservationId: req.params.id }) as unknown[]
  return { status: 200, body: { data } }
})

router.post('/api/reservations/:id/addons', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const res = await orm.findById('Reservations', req.params.id) as { hotelId?: string } | null
  if (!res) return { status: 404, body: { error: 'Reserva no encontrada' } }
  const body = req.body as { description?: string; kind?: string; amount?: number; quantity?: number }
  if (!body?.description) return { status: 400, body: { error: 'description requerido' } }
  const addon = await orm.create('ReservationAddons', {
    id: crypto.randomUUID(), reservationId: req.params.id, hotelId: res.hotelId,
    description: body.description, kind: body.kind === 'discount' ? 'discount' : 'service',
    amount: Number(body.amount) || 0, quantity: Number(body.quantity) || 1,
  })
  return { status: 201, body: addon }
})

router.delete('/api/addons/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  await orm.delete('ReservationAddons', req.params.id)
  return { status: 200, body: { success: true } }
})

// ─── GET /api/reservations/:id — Detalle extendido (OTA + companions) ───────
router.get('/api/reservations/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const r = await orm.findById('Reservations', req.params.id) as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  const [guest, room, companions, lockCodes, payments, messageLogs, addons] = await Promise.all([
    r.guestId ? orm.findById('Guests', r.guestId) : Promise.resolve(null),
    r.roomId ? orm.findById('Rooms', r.roomId) : Promise.resolve(null),
    orm.findMany('Companions', { reservationId: r.id }) as Promise<any[]>,
    orm.findMany('LockCodes', { reservationId: r.id }) as Promise<any[]>,
    orm.findMany('PaymentRequests', { reservationId: r.id }) as Promise<any[]>,
    system.resolveModule<{ listMessageLogs: (h: string, rid?: string) => Promise<any[]> }>('marketing')?.listMessageLogs(r.hotelId, r.id) ?? Promise.resolve([]),
    orm.findMany('ReservationAddons', { reservationId: r.id }) as Promise<any[]>,
  ])
  // El detalle NO expone los datos de la tarjeta de garantía (titular, marca, últimos 4, vencimiento).
  // Solo indica si existe (hasGuaranteeCard). Los datos se revelan únicamente vía unlock con PIN.
  const CARD_FIELDS = ['cardHolder', 'cardBrand', 'cardLast4', 'cardExpMonth', 'cardExpYear']
  const safeReservation = Object.fromEntries(Object.entries(r).filter(([k]: [string, unknown]) => !CARD_FIELDS.includes(k)))
  return { status: 200, body: {
    ...safeReservation,
    hasGuaranteeCard: !!(r.hasGuaranteeCard || r.cardLast4),
    guest: guest || null,
    room: room || null,
    companions,
    lockCodes,
    payments,
    messageLogs,
    addons,
    // Check-in digital: hash derivado del id (mapeo de QScanPro de MisterPlan — sin marca externa).
    checkinCode: String(r.id).replace(/-/g, '').slice(0, 12),
    pendingAmount: Math.max(0, (r.totalAmount || 0) - (r.deposit || 0)),
  } }
})

// ─── Tarjeta de garantía (MisterPlan): PIN del hotel + unlock ───────────────
// El PIN se guarda en `configuration` (key: guarantee_pin) hasheado con SHA-256 (pepper: hotelId + JWT_SECRET).
router.post('/api/guarantee/pin', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const { pin } = req.body as { pin?: string }
  if (!pin || !/^\d{4,8}$/.test(String(pin))) {
    return { status: 400, body: { error: 'PIN inválido (debe ser de 4 a 8 dígitos)' } }
  }
  const hash = hashGuaranteePin(String(pin), id)
  const existing = (await orm.findMany('Configuration', { hotelId: id, key: 'guarantee_pin' }))[0] as any
  if (existing) await orm.update('Configuration', existing.id, { value: hash })
  else await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: id, key: 'guarantee_pin', value: hash })
  return { status: 200, body: { success: true } }
})

router.get('/api/guarantee/has-pin', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  if (!id) return { status: 401, body: { error: 'Hotel no encontrado' } }
  const row = (await orm.findMany('Configuration', { hotelId: id, key: 'guarantee_pin' }))[0] as any
  return { status: 200, body: { hasPin: !!row } }
})

router.post('/api/reservations/:id/guarantee-card/unlock', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const r = await orm.findById('Reservations', req.params.id) as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  const hid = await hotelOf(req)
  if (!hid) return { status: 401, body: { error: 'Hotel no encontrado' } }
  if (r.hotelId !== hid) return { status: 403, body: { error: 'Sin acceso a esta reserva' } }
  if (!r.hasGuaranteeCard && !r.cardLast4) return { status: 400, body: { error: 'Esta reserva no tiene tarjeta de garantía' } }
  const pinRow = (await orm.findMany('Configuration', { hotelId: hid, key: 'guarantee_pin' }))[0] as any
  if (!pinRow?.value) return { status: 400, body: { error: 'No hay PIN de garantía configurado' } }
  const { pin } = req.body as { pin?: string }
  if (!pin || !verifyGuaranteePin(String(pin), hid, String(pinRow.value))) {
    return { status: 403, body: { error: 'PIN incorrecto' } }
  }
  return { status: 200, body: {
    cardHolder: r.cardHolder || '',
    cardBrand: r.cardBrand || '',
    cardLast4: r.cardLast4 || '',
    cardExpMonth: r.cardExpMonth || '',
    cardExpYear: r.cardExpYear || '',
  } }
})

// D7 — Historial de cambios (audit trail) de una reserva.
router.get('/api/reservations/:id/audit', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hid = await hotelOf(req)
  const role = (req.user as any).role
  const r = await orm.findById('Reservations', req.params.id) as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  if (role !== 'super_admin' && r.hotelId !== hid) return { status: 403, body: { error: 'Sin acceso' } }
  const logs = (await orm.findMany('Auditlog', { entity: 'Reservations', entityId: req.params.id })) as any[]
  const sorted = logs
    .filter((l: any) => role === 'super_admin' || l.hotelId === r.hotelId || l.hotelId === 'unknown')
    .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { status: 200, body: { data: sorted } }
})

// Payment Requests (CRUD + Stripe checkout + webhook) → migrado a módulo payment-requests (F1).

// ═══════════════════════════════════════════════════════════════════════════
// PC-3 Stripe — Checkout Session + Webhook
// ═══════════════════════════════════════════════════════════════════════════
import { StripeService } from './services/stripe-service'

// ─── Routes extraídos ─────────────────────────────────────────────────────
import { registerAdminRoutes } from './routes/admin'
import { registerReportRoutes } from './routes/reports'
import { registerSettingsRoutes } from './routes/settings'

// Stripe status + create-checkout → migrado a módulo payment-requests (F1).

// Stripe webhook → migrado a módulo payment-requests (F1). El setConfigResolver de abajo se preserva.

// Inyectar resolver de config Stripe por hotel (configuration['stripe_config'] + fallback a env).
StripeService.setConfigResolver(async (hotelId) => {
  if (!hotelId) return null
  const rows = await orm.findMany('Configuration', { hotelId, key: 'stripe_config' }) as any[]
  const v = rows[0]?.value
  let cfg: any = v
  if (typeof v === 'string') { try { cfg = JSON.parse(v) } catch { cfg = null } }
  return cfg || null
})

// ─── Feedback / GitLab Issue Creator ────────────────────────────────────
router.post('/api/feedback/gitlab-issue', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
  const { screenshot, filename, comment, route, x, y, browser, viewportWidth, viewportHeight } = req.body

  const GITLAB_TOKEN = process.env.GITLAB_TOKEN
  const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID

  if (!GITLAB_TOKEN || !GITLAB_PROJECT_ID) {
    return { status: 400, body: { error: 'GitLab no configurado en el servidor' } }
  }

  const GITLAB_API = `https://gitlab.com/api/v4/projects/${encodeURIComponent(GITLAB_PROJECT_ID)}`
  const user = req.user ?? {}

  // 1. Upload screenshot as GitLab file attachment
  const imgBase64 = screenshot.split(',')[1]
  if (!imgBase64) return { status: 400, body: { error: 'Screenshot inválido' } }

  const imgBuffer = Buffer.from(imgBase64, 'base64')
  const formData = new FormData()
  const blob = new Blob([imgBuffer], { type: 'image/png' })
  formData.append('file', blob, filename || `feedback-${Date.now()}.png`)

  const uploadRes = await fetch(`${GITLAB_API}/uploads`, {
    method: 'POST',
    headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
    body: formData,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    logger.error('GitLab upload failed', { status: uploadRes.status, body: errText })
    return { status: 502, body: { error: 'Error al subir screenshot a GitLab', detail: errText } }
  }

  const uploadData = (await uploadRes.json()) as any
  const imgMarkdown = uploadData.markdown || `![screenshot](${uploadData.url})`

  // 2. Create GitLab issue
  const title = `[Feedback] ${comment.length > 72 ? comment.slice(0, 72) + '…' : comment}`
  const description = [
    '## 📸 Screenshot',
    '',
    imgMarkdown,
    '',
    '---',
    '',
    '## 📝 Detalles del Feedback',
    '',
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Comentario** | ${comment} |`,
    `| **Ruta** | \`${route}\` |`,
    `| **Coordenadas** | (${x}, ${y}) |`,
    `| **Browser** | ${browser} |`,
    `| **Viewport** | ${viewportWidth}×${viewportHeight} |`,
    `| **Usuario** | ${(user as any).email || 'desconocido'} |`,
    `| **Timestamp** | ${new Date().toISOString()} |`,
  ].join('\n')

  const issueRes = await fetch(`${GITLAB_API}/issues`, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': GITLAB_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      description,
      labels: 'feedback',
    }),
  })

  if (!issueRes.ok) {
    const errText = await issueRes.text()
    logger.error('GitLab issue creation failed', { status: issueRes.status, body: errText })
    return { status: 502, body: { error: 'Error al crear issue en GitLab', detail: errText } }
  }

  const issueData = (await issueRes.json()) as any

  logger.info('GitLab issue creado desde feedback', { issueUrl: issueData.web_url, route })

  return {
    status: 201,
    body: {
      issueUrl: issueData.web_url,
      issueId: issueData.iid,
      title: issueData.title,
    },
  }
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
