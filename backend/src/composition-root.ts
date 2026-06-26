// src/composition-root.ts — ManagerHotel / SOLMI OS
// Entry point con arckode-framework. Estructura canónica: System → módulos → start.

import {
  System, ConfigStore, Logger, Router, MemoryCache, ORM, Container, OrmRepository, NodeServer,
} from 'arckode-framework'
import { cors } from 'arckode-framework/middlewares'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { HotelAuth } from './infrastructure/auth/hotel-auth'

// ─── Config (todo desde .env) ──────────────────────────────────────────────
const config = new ConfigStore()
config.define({
  PORT: { type: 'number', default: '3001' },
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

// Modelo de configuración (KV multi-tenant) — registrado acá por ser cross-module
orm.define('Configuration', {
  table: 'configuration', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    key: { type: 'string', required: true, indexed: true },
    value: { type: 'json', default: {} },
  },
})

// Planes de suscripción (SaaS)
orm.define('Plans', {
  table: 'plans', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    slug: { type: 'string', required: true, indexed: true },
    price: { type: 'number', required: true },
    currency: { type: 'string', default: 'USD' },
    description: { type: 'string', default: '' },
    features: { type: 'json', default: [] },
    limits: { type: 'json', default: { rooms: 30, users: 2, properties: 1 } },
    isActive: { type: 'number', default: 1 },
    sortOrder: { type: 'number', default: 0 },
  },
})

// Catálogo global de amenities
orm.define('AmenitiesCatalog', {
  table: 'amenities_catalog', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    key: { type: 'string', required: true, indexed: true },
    label: { type: 'string', required: true },
    category: { type: 'string', default: 'interior' },
    icon: { type: 'string', default: '' },
    isActive: { type: 'number', default: 1 },
    sortOrder: { type: 'number', default: 0 },
  },
})

// Historial de sincronización con Channex
orm.define('SyncLog', {
  table: 'sync_log', timestamps: false,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    channel: { type: 'string' },
    action: { type: 'string', required: true },
    status: { type: 'string', default: 'success' },
    details: { type: 'json', default: {} },
    createdAt: { type: 'string' },
  },
})

// Restricciones de tarifas (min_stay, max_stay, cta, ctd)
orm.define('RateRestrictions', {
  table: 'rate_restrictions', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomType: { type: 'string', required: true },
    season: { type: 'string', required: true },
    minStay: { type: 'number', default: 0 },
    maxStay: { type: 'number', default: 0 },
    cta: { type: 'number', default: 0 },
    ctd: { type: 'number', default: 0 },
    closedToArrival: { type: 'number', default: 0 },
    closedToDeparture: { type: 'number', default: 0 },
  },
})

// ─── Modelos ORM Fase 1 (Foundation) ───────────────────────────────────────
// Amenities del hotel y de habitaciones
orm.define('HotelAmenities', {
  table: 'hotel_amenities', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    amenityKey: { type: 'string', required: true },
    amenityCategory: { type: 'string', default: 'interior' },
    isActive: { type: 'boolean', default: true },
  },
})

orm.define('RoomAmenities', {
  table: 'room_amenities', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    roomId: { type: 'string', required: true, indexed: true },
    amenityKey: { type: 'string', required: true },
    isShared: { type: 'boolean', default: false },
    isActive: { type: 'boolean', default: true },
  },
})

// Temporadas (Baja, Media, Alta, Especial)
orm.define('Seasons', {
  table: 'seasons', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    label: { type: 'string' },
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    color: { type: 'string', default: '#3b82f6' },
    sortOrder: { type: 'number', default: 0 },
  },
})

// Matriz de tarifas (tipo × ocupación × temporada)
orm.define('RoomRates', {
  table: 'room_rates', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomType: { type: 'string', required: true },
    occupancy: { type: 'number', required: true },
    season: { type: 'string', required: true },
    price: { type: 'number', required: true, default: 0 },
  },
})

// Cerraduras TTLock
orm.define('LockDevices', {
  table: 'lock_devices', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomId: { type: 'string' },
    ttlockLockId: { type: 'string' },
    name: { type: 'string' },
    mac: { type: 'string' },
    batteryLevel: { type: 'number', default: 0 },
    status: { type: 'string', default: 'offline' },
  },
})

orm.define('LockCodes', {
  table: 'lock_codes', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    lockId: { type: 'string', required: true, indexed: true },
    reservationId: { type: 'string' },
    code: { type: 'string' },
    codeType: { type: 'string', default: 'time' },
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    status: { type: 'string', default: 'pending' },
    ttlockKeyboardPwdId: { type: 'string' },
    sentVia: { type: 'string' },
    sentAt: { type: 'string' },
  },
})

// Auto-mensajes programados → extraído a modules/marketing/
// orm.define('AutoMessages', ...) — ahora en registerMarketingModels(orm)

// Acompañantes de reservas
orm.define('Companions', {
  table: 'companions', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    reservationId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    documentType: { type: 'string' },
    documentNumber: { type: 'string' },
    nationality: { type: 'string' },
    birthDate: { type: 'string' },
    isMainGuest: { type: 'boolean', default: false },
  },
})



// Requerimientos de pago (Stripe)
orm.define('PaymentRequests', {
  table: 'payment_requests', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    reservationId: { type: 'string', required: true, indexed: true },
    amount: { type: 'number', required: true, default: 0 },
    currency: { type: 'string', default: 'USD' },
    stripeSessionId: { type: 'string' },
    stripePaymentUrl: { type: 'string' },
    status: { type: 'string', default: 'pending' },
    sentTo: { type: 'string' },
    sentVia: { type: 'string', default: 'email' },
    paidAt: { type: 'string' },
  },
})



// Bloqueos de habitaciones (Planning)
orm.define('RoomBlocks', {
  table: 'room_blocks', timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomId: { type: 'string', required: true, indexed: true },
    reason: { type: 'string' },
    startDate: { type: 'string', required: true },
    endDate: { type: 'string', required: true },
    createdBy: { type: 'string' },
  },
})

// ─── Auth / Router / HTTP ──────────────────────────────────────────────────
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
import { BookingengineModule } from './modules/bookingengine'
import type { FoliosService } from './modules/folios'
import { taxRateFor } from './modules/folios/usecases/folio-math'
import type { FacturasService } from './modules/facturas'

const mods = [
  UsuariosModule(), HabitacionesModule(), ReservasModule(), HuespedesModule(),
  FacturasModule(), HousekeepingModule(), MantenimientoModule(), PaquetesModule(),
  GruposModule(), HotelesModule(), RolesModule(), DispositivosModule(),
  AnunciosModule(), ApikeysModule(), AuditlogModule(), TicketsModule(), NotificacionesModule(),
  CanalesModule(),
  OpinionesModule(), GastosModule(), FoliosModule(), PaymentsModule(), EmpleadosModule(), PayrollModule(), AttendanceModule(), CrmModule(), MarketingModule(), AiRecepcionistaModule(), BookingengineModule(),
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

// ─── Conector: booking-engine → canales (sync availability después de reserva directa)
import { bookingChannexConnector } from './connectors/booking-channex'
system.addConnector('booking-channex', bookingChannexConnector)

// ─── Conector: reservas → huéspedes (check-out actualiza stats + puntos) ────
import { reservasHuespedesConnector } from './connectors/reservas-huespedes'
system.addConnector('reservas-huespedes', reservasHuespedesConnector)

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
  return { status: 201, body: { folio: linked, invoice } }
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
router.post('/api/reservas/:id/checkin', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hotelId = await hotelOf(req)
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

  // 1) Huésped: si la reserva no tiene (OTA), crear walk-in; si tiene, +1 estadía.
  let guestId = r.guestId
  if (!guestId) {
    const guestName = r.externalLocator ? `Pasajero ${r.externalLocator}` : 'Pasajero walk-in'
    const guest = await orm.create('Guests', {
      id: crypto.randomUUID(), name: guestName, hotelId: r.hotelId, active: 1,
      totalStays: 1, totalSpent: 0, tier: 'bronze', notes: r.otaNotes || null,
    }) as any
    guestId = guest.id
  } else {
    const g = (await orm.findMany('Guests', { id: guestId }))[0] as any
    if (g) await orm.update('Guests', guestId, { totalStays: (Number(g.totalStays) || 0) + 1 })
  }

  // 2) Folio abierto vinculado a la reserva.
  const folio = await orm.create('Folios', {
    id: crypto.randomUUID(), hotelId: r.hotelId, reservationId: r.id, guestId, roomId: r.roomId,
    status: 'open', currency: r.currency || 'USD', invoiceId: null, openedAt: nowIso, closedAt: null,
  }) as any

  // 3) Reserva → checked_in + auditoría + folio + guest.
  await orm.update('Reservations', r.id, {
    status: 'checked_in', checkedInAt: nowIso, folioId: folio.id, guestId,
  })

  // 4) Habitación → occupied.
  await orm.update('Rooms', r.roomId, { status: 'occupied' })

  // 5) Recalcular availability en Channex (la room pasa a ocupada sus noches).
  pushAvailabilityToChannex(r.hotelId, r.roomId)

  return { status: 200, body: { ok: true, reservationId: r.id, status: 'checked_in', folioId: folio.id, guestId } }
})

router.post('/api/reservas/:id/checkout', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hotelId = await hotelOf(req)
  const r = (await orm.findMany('Reservations', { id: req.params.id }))[0] as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  if ((req.user as any).role !== 'super_admin' && r.hotelId !== hotelId) {
    return { status: 403, body: { error: 'No autorizado' } }
  }
  if (r.status !== 'checked_in') {
    return { status: 409, body: { error: `Solo se puede hacer check-out de una reserva con check-in (actual: ${r.status})` } }
  }

  const nowIso = new Date().toISOString()
  await orm.update('Reservations', r.id, { status: 'checked_out', checkedOutAt: nowIso })
  await orm.update('Rooms', r.roomId, { status: 'cleaning' })

  // Tarea de limpieza (mismo efecto que el conector reservas-housekeeping al detectar checked_out).
  await orm.create('Housekeeping', {
    id: crypto.randomUUID(), roomId: r.roomId, hotelId: r.hotelId,
    type: 'full_cleaning', priority: 'high', status: 'pending',
  })

  // Recalcular availability en Channex (la reserva deja de contar al pasar a checked_out).
  pushAvailabilityToChannex(r.hotelId, r.roomId)

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

// Endpoint público — demo accounts para login (sin auth, sin query a DB)
router.get('/api/public/users', async () => {
  return { status: 200, body: [
    { name: 'Admin', email: 'admin@managerhotel.com', role: 'hotel_admin' },
    { name: 'Admin Caribe', email: 'admin@caribeparadise.com', role: 'hotel_admin' },
    { name: 'Maria Caribe', email: 'maria@caribeparadise.com', role: 'hotel_admin' },
  ] }
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
  const hash = req.params.hash
  const reservas = await orm.findMany('Reservations', {}) as any[]
  const reservation = reservas.find((r: any) => {
    const h = String(r.id).replace(/-/g, '').slice(0, 12)
    return h === hash || r.id === hash
  })
  if (!reservation) return { status: 404, body: { success: false, error: { message: 'Reserva no encontrada' } } }
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
  const hash = req.params.hash
  const body = req.body as any
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
  const body = req.body as any
  const cfg = await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }) as any[]
  const value = JSON.stringify({ clientId: body.clientId || '', clientSecret: body.clientSecret || '', accountId: body.accountId || '', accessToken: body.accessToken || '' })
  if (cfg.length > 0) { await orm.update('Configuration', cfg[0].id, { value }) }
  else { await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: id, key: 'ttlock_config', value }) }
  return { status: 200, body: { success: true } }
})

router.get('/api/ttlock/config', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const cfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
  const parsed = cfg ? safeParse(cfg.value) : {}
  return { status: 200, body: { ...parsed, configured: !!(parsed?.clientId && parsed?.clientSecret) } }
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
  const cfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
  const parsed = cfg ? safeParse(cfg.value) : {}
  if (!parsed?.clientId) return { status: 400, body: { error: 'TTLock no configurado' } }
  // En producción: fetch de TTLock API con clientId/clientSecret/accessToken
  return { status: 200, body: { success: true, message: 'Sincronización simulada — conecta TTLock real para sincronizar', synced: 0 } }
})

router.post('/api/ttlock/generate-code/:reservationId', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const { reservationId } = req.params
  const res = await orm.findById('Reservations', reservationId) as any
  if (!res) return { status: 404, body: { error: 'Reserva no encontrada' } }
  const lock = (await orm.findMany('LockDevices', { roomId: res.roomId }))[0] as any
  if (!lock) return { status: 404, body: { error: 'Sin cerradura asignada a esta habitación' } }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeEntry = await orm.create('LockCodes', {
    id: crypto.randomUUID(), lockId: lock.id, reservationId,
    code, codeType: 'time', startDate: String(res.checkIn).slice(0, 10),
    endDate: String(res.checkOut).slice(0, 10), status: 'active', sentVia: '',
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

// ─── Caja: registro de cobros ──────────────────────────────────────
router.get('/api/caja', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const data = await orm.findMany('Configuration', { hotelId: id, key: 'caja_movements' }) as any[]
  const movements = data.length > 0 ? safeParse(data[0].value) || [] : []
  return { status: 200, body: { data: Array.isArray(movements) ? movements : [] } }
})

router.post('/api/caja', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const body = req.body as any
  const data = await orm.findMany('Configuration', { hotelId: id, key: 'caja_movements' }) as any[]
  const movements = data.length > 0 ? safeParse(data[0].value) || [] : []
  const entry = { id: crypto.randomUUID(), date: body.date, amount: body.amount, guestName: body.guestName, concept: body.concept, method: body.method, roomNumber: body.roomNumber, createdAt: new Date().toISOString() }
  movements.unshift(entry)
  const value = JSON.stringify(movements)
  if (data.length > 0) { await orm.update('Configuration', data[0].id, { value }) }
  else { await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: id, key: 'caja_movements', value }) }
  return { status: 201, body: entry }
})

router.delete('/api/caja/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const data = await orm.findMany('Configuration', { hotelId: id, key: 'caja_movements' }) as any[]
  const movements = data.length > 0 ? safeParse(data[0].value) || [] : []
  const filtered = movements.filter((m: any) => m.id !== req.params.id)
  if (data.length > 0) { await orm.update('Configuration', data[0].id, { value: JSON.stringify(filtered) }) }
  return { status: 200, body: { success: true } }
})

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

// ─── GET /api/reservations/:id — Detalle extendido (OTA + companions) ───────
router.get('/api/reservations/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const r = await orm.findById('Reservations', req.params.id) as any
  if (!r) return { status: 404, body: { error: 'Reserva no encontrada' } }
  const [guest, room, companions, lockCodes, payments, messageLogs] = await Promise.all([
    r.guestId ? orm.findById('Guests', r.guestId) : Promise.resolve(null),
    r.roomId ? orm.findById('Rooms', r.roomId) : Promise.resolve(null),
    orm.findMany('Companions', { reservationId: r.id }) as Promise<any[]>,
    orm.findMany('LockCodes', { reservationId: r.id }) as Promise<any[]>,
    orm.findMany('PaymentRequests', { reservationId: r.id }) as Promise<any[]>,
    system.resolveModule<{ listMessageLogs: (h: string, rid?: string) => Promise<any[]> }>('marketing')?.listMessageLogs(r.hotelId, r.id) ?? Promise.resolve([]),
  ])
  return { status: 200, body: {
    ...r,
    guest: guest || null,
    room: room || null,
    companions,
    lockCodes,
    payments,
    messageLogs,
    pendingAmount: Math.max(0, (r.totalAmount || 0) - (r.deposit || 0)),
  } }
})

// ─── Payment Requests — CRUD ────────────────────────────────────────────────
router.get('/api/payment-requests', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const { reservationId } = req.query as any
  const query: any = { hotelId: id }
  if (reservationId) query.reservationId = reservationId
  const data = await orm.findMany('PaymentRequests', query) as any[]
  return { status: 200, body: { data } }
})

router.post('/api/payment-requests', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const id = await hotelOf(req)
  const body = req.body as any
  if (!body.reservationId || !body.amount) return { status: 400, body: { error: 'reservationId y amount requeridos' } }
  const pr = await orm.create('PaymentRequests', {
    id: crypto.randomUUID(), hotelId: id, reservationId: body.reservationId,
    amount: Number(body.amount), currency: body.currency || 'USD',
    status: 'pending', sentTo: body.sentTo || '', sentVia: body.sentVia || 'email',
  })
  return { status: 201, body: pr }
})

router.put('/api/payment-requests/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  const body = req.body as any
  const patch: Record<string, any> = {}
  for (const k of ['amount','status','stripeSessionId','stripePaymentUrl','sentTo','sentVia','paidAt']) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  await orm.update('PaymentRequests', req.params.id, patch)
  return { status: 200, body: await orm.findById('PaymentRequests', req.params.id) }
})

router.delete('/api/payment-requests/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
  await orm.delete('PaymentRequests', req.params.id)
  return { status: 200, body: { success: true } }
})

// ═══════════════════════════════════════════════════════════════════════════
// PC-3 Stripe — Checkout Session + Webhook
// ═══════════════════════════════════════════════════════════════════════════
import { StripeService } from './services/stripe-service'

// ─── Routes extraídos ─────────────────────────────────────────────────────
import { registerAdminRoutes } from './routes/admin'
import { registerReportRoutes } from './routes/reports'
import { registerSettingsRoutes } from './routes/settings'

// Status de configuración (frontend lo consulta para mostrar/ocultar botón Stripe)
router.get('/api/stripe/status', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hotelId = await hotelOf(req)
  const cfg = await StripeService.getConfig(hotelId)
  return { status: 200, body: { configured: !!cfg.secretKey, publishableKey: cfg.publishableKey || '', currency: cfg.currency || 'usd' } }
})

// Crear Checkout Session para un PaymentRequest existente
router.post('/api/payment-requests/:id/create-checkout', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req) => {
  const hotelId = await hotelOf(req)
  if (!(await StripeService.isConfigured(hotelId))) {
    return { status: 503, body: { error: 'Stripe no configurado', hint: 'Configurá las keys en Settings > Conectar Stripe o en .env' } }
  }
  const id = req.params.id
  const pr = await orm.findById('PaymentRequests', id) as any
  if (!pr) return { status: 404, body: { error: 'Payment request no encontrado' } }
  if (pr.status === 'paid') return { status: 400, body: { error: 'Ya está pagado' } }

  const origin = (req.headers?.origin as string) || `http://localhost:${PORT}`
  const guestEmail = pr.sentTo?.includes('@') ? pr.sentTo : undefined
  try {
    const result = await StripeService.createCheckoutSession({
      hotelId,
      paymentRequestId: id,
      amount: Number(pr.amount),
      currency: pr.currency || 'usd',
      description: `Reserva ${String(pr.reservationId || '').slice(0, 8)}`,
      successUrl: `${origin}/panel/payments?status=paid&id=${id}`,
      cancelUrl: `${origin}/panel/payments?status=cancelled&id=${id}`,
      customerEmail: guestEmail,
      metadata: { hotelId: pr.hotelId, reservationId: pr.reservationId || '' },
    })
    await orm.update('PaymentRequests', id, {
      stripeSessionId: result.sessionId,
      stripePaymentUrl: result.sessionUrl,
    })
    return { status: 200, body: { url: result.sessionUrl, sessionId: result.sessionId } }
  } catch (e: any) {
    logger.error('Stripe create checkout failed', e)
    return { status: 500, body: { error: 'Error al crear sesión de pago', detail: e.message } }
  }
})

// Webhook público (sin auth, firma verificada con STRIPE_WEBHOOK_SECRET)
// Nota: Stripe requiere el raw body. El framework entrega req.body ya parseado.
// Para producción usar el adapter http raw o express middleware. Esta versión
// usa constructEventAsync con tolerancia de firma extendida.
router.post('/api/stripe/webhook', async (req) => {
  if (!StripeService.isConfigured()) {
    return { status: 503, body: { error: 'Stripe no configurado' } }
  }
  const signature = (req.headers?.['stripe-signature'] as string) || ''
  if (!signature) return { status: 400, body: { error: 'Falta stripe-signature' } }

  let event: any
  try {
    // El framework arckode parsea JSON automáticamente. Stripe necesita el raw.
    // Workaround: re-stringificar. En producción usar middleware raw para /webhook.
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    event = await StripeService.verifyWebhook(rawBody, signature)
  } catch (e: any) {
    logger.warn('Stripe webhook signature failed', { error: e.message })
    return { status: 400, body: { error: 'Firma inválida', detail: e.message } }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const paymentRequestId = session.metadata?.paymentRequestId
        if (paymentRequestId) {
          // Idempotente: solo procesar si no estaba ya paid (reintentos de webhook).
          const pr = await orm.findById('PaymentRequests', paymentRequestId) as any
          if (pr && pr.status !== 'paid') {
            await orm.update('PaymentRequests', paymentRequestId, {
              status: 'paid',
              paidAt: new Date().toISOString(),
              stripeSessionId: session.id,
            })
            // Bridge: aplicar el pago al folio + actualizar la reserva.
            const amountPaid = Math.abs(Number(session.amount_total ?? pr.amount ?? 0)) / 100
            const reservationId = session.metadata?.reservationId || pr.reservationId
            const hotelId = session.metadata?.hotelId || pr.hotelId
            if (reservationId) {
              const resRows = await orm.findMany('Reservations', { id: reservationId }) as any[]
              const res = resRows[0]
              if (res) {
                const newDeposit = Number(res.deposit || 0) + amountPaid
                const total = Number(res.totalAmount || 0)
                const update: any = {
                  deposit: newDeposit,
                  paymentMethod: 'stripe',
                  pendingAmount: Math.max(0, total - newDeposit),
                }
                if (res.status === 'pending' && newDeposit >= total) update.status = 'confirmed'
                await orm.update('Reservations', reservationId, update)
              }
              // Folio abierto de la reserva → registrar el pago como cargo tipo payment.
              const folios = await orm.findMany('Folios', { reservationId }) as any[]
              const openFolio = folios.find((f: any) => f.status === 'open')
              if (openFolio && amountPaid > 0) {
                await orm.create('FolioCharges', {
                  id: crypto.randomUUID(), folioId: openFolio.id, hotelId,
                  description: `Pago Stripe · Ref ${session.payment_intent || session.id}`,
                  category: 'payment', kind: 'payment', quantity: 1,
                  amount: -amountPaid, taxes: 0, total: -amountPaid, source: 'stripe',
                  postedAt: new Date().toISOString(),
                } as any)
              }
            }
            logger.info('Stripe payment completed + applied', { paymentRequestId, reservationId, amountPaid })
          }
        }
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as any
        const paymentRequestId = session.metadata?.paymentRequestId
        if (paymentRequestId) {
          await orm.update('PaymentRequests', paymentRequestId, { status: 'expired' })
        }
        break
      }
      case 'payment_intent.payment_failed': {
        logger.warn('Stripe payment failed', { event })
        break
      }
      default:
        // Eventos no manejados — log silencioso
        break
    }
    return { status: 200, body: { received: true } }
  } catch (e: any) {
    logger.error('Stripe webhook handler failed', e)
    return { status: 500, body: { error: 'Internal error' } }
  }
})

// Inyectar resolver de config Stripe por hotel (configuration['stripe_config'] + fallback a env).
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

process.on('SIGINT', async () => { await system.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await system.stop(); process.exit(0) })
