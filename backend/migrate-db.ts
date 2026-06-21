// migrate-db.ts — Crea tablas faltantes + seed realista. Idempotente.
// Tablas y columnas en INGLÉS (regla DB English Only del CLAUDE.md).
import { Database } from "bun:sqlite"
import { join } from "path"

const db = new Database(join(import.meta.dir, "data", "managerhotel.db"))
db.exec("PRAGMA foreign_keys=ON;")
const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const HID = (db.query("SELECT id FROM hotels LIMIT 1").get() as any)?.id
const USERS = db.query("SELECT id, name, email, role FROM users").all() as any[]
const ROOMS = db.query("SELECT id, number, type FROM rooms").all() as any[]
const GUESTS = db.query("SELECT id, name FROM guests").all() as any[]
console.log(`Hotel: ${HID} | Users: ${USERS.length} | Rooms: ${ROOMS.length} | Guests: ${GUESTS.length}`)

function exec(sql: string) { try { db.exec(sql) } catch (e: any) { if (!e.message.includes("already exists")) throw e } }
function run(sql: string, p: any[] = []) { db.run(sql, ...p) }

// ─── Tablas (DDL en inglés, idempotente) ────────────────────────
exec(`CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  type TEXT DEFAULT 'upsell', price REAL NOT NULL, contents TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1, createdAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, hotelId TEXT, userId TEXT, userName TEXT,
  device TEXT, icon TEXT DEFAULT '🖥️', browser TEXT, os TEXT,
  ip TEXT, isMobile INTEGER DEFAULT 0, lastActivity TEXT,
  createdAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY, hotelId TEXT, authorId TEXT, title TEXT NOT NULL, message TEXT,
  type TEXT DEFAULT 'info', priority TEXT DEFAULT 'medium', active INTEGER DEFAULT 1,
  date TEXT DEFAULT (datetime('now')), createdAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY, hotelId TEXT, name TEXT NOT NULL, scope TEXT,
  masked TEXT, secretHash TEXT, active INTEGER DEFAULT 1, requests INTEGER DEFAULT 0,
  lastUsed TEXT, createdAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, hotelId TEXT, userId TEXT, userName TEXT,
  action TEXT NOT NULL, entity TEXT, entityId TEXT, detail TEXT, ip TEXT,
  createdAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS configuration (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, key TEXT NOT NULL, value TEXT DEFAULT '{}',
  updatedAt TEXT DEFAULT (datetime('now')), UNIQUE(hotelId, key))`)

exec(`CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, leadGuestId TEXT,
  totalRooms INTEGER DEFAULT 1, checkIn TEXT, checkOut TEXT, status TEXT DEFAULT 'pendiente',
  totalAmount REAL DEFAULT 0, notes TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT)`)

exec(`CREATE TABLE IF NOT EXISTS maintenance (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, roomId TEXT, roomNumber TEXT,
  title TEXT NOT NULL, description TEXT, category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'open', assignedTo TEXT,
  estimatedCost REAL DEFAULT 0, reportedDate TEXT, resolvedDate TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT)`)

exec(`CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT NOT NULL,
  subject TEXT NOT NULL, category TEXT DEFAULT 'technical', priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open', description TEXT, attachments TEXT,
  assignedTo TEXT, slaStatus TEXT, slaBreached INTEGER DEFAULT 0, messages TEXT DEFAULT '[]',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT, type TEXT DEFAULT 'sistema',
  title TEXT NOT NULL, message TEXT, read INTEGER DEFAULT 0, sent INTEGER DEFAULT 0,
  date TEXT, channel TEXT, metadata TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── Seed: PACKAGES ─────────────────────────────────────────────
function seedPaquetes() {
  const c = (db.query("SELECT COUNT(*) as c FROM packages").get() as any).c
  if (c > 0) return console.log("packages: ya tiene datos")
  const items = [
    ["Suite Romántica", "Decoración floral, champagne, cena para 2", "upsell", 85, '["Botella de champagne","Pétalos de rosa","Cena romántica","Late check-out"]'],
    ["Spa & Bienestar", "Masaje pareja + acceso al spa", "combo", 120, '["Masaje pareja 60min","Sauna","Desayuno saludable"]'],
    ["Airport Transfer", "Traslado privado ida y vuelta", "service", 45, '["Traslado privado","Conductor bilingüe"]'],
    ["Tour Local", "Excursión guiada por la zona", "combo", 65, '["Guía certificado","Transporte","Almuerzo típico"]'],
    ["Late Check-out", "Salida hasta las 18:00", "upsell", 25, '["Check-out extendido 18:00"]'],
  ]
  for (const [name, description, type, price, contents] of items)
    run("INSERT INTO packages (id, hotelId, name, description, type, price, contents) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, name, description, type, price, contents])
  console.log(`packages: ${items.length} insertados`)
}

// ─── Seed: DEVICES ──────────────────────────────────────────────
function seedDispositivos() {
  const c = (db.query("SELECT COUNT(*) as c FROM devices").get() as any).c
  if (c > 0) return console.log("devices: ya tiene datos")
  const sessions = [
    [USERS[2]?.name ?? "María López", "iPhone 15", "📱", "Safari 18", "iOS 18.4", "187.56.23.10", 1, "Hace 15 min"],
    [USERS[1]?.name ?? "Juan García", "Desktop PC", "🖥️", "Chrome 132", "Windows 11", "192.168.1.45", 0, "Ahora"],
    [USERS[0]?.name ?? "Super Admin", "MacBook Pro", "💻", "Chrome 132", "macOS 15", "201.34.89.22", 0, "Hace 3 min"],
    ["Ana Torres", "iPad Pro", "📲", "Safari 18", "iPadOS 18.4", "110.23.88.34", 1, "Hace 3 horas"],
    ["Pedro Méndez", "Desktop Dell", "🖥️", "Firefox 135", "Ubuntu 24", "91.56.12.90", 0, "Ayer, 18:30"],
  ]
  for (const [userName, device, icon, browser, os, ip, isMobile, lastActivity] of sessions)
    run("INSERT INTO devices (id, hotelId, userName, device, icon, browser, os, ip, isMobile, lastActivity) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [uuid(), HID, userName, device, icon, browser, os, ip, isMobile, lastActivity])
  console.log(`devices: ${sessions.length} insertados`)
}

// ─── Seed: ANNOUNCEMENTS ────────────────────────────────────────
function seedAnuncios() {
  const c = (db.query("SELECT COUNT(*) as c FROM announcements").get() as any).c
  if (c > 0) return console.log("announcements: ya tiene datos")
  const items = [
    ["Mantenimiento programado", "El sistema estará disponible el domingo 3-5 AM por mantenimiento.", "warning", "high"],
    ["Nueva versión disponible", "Se agregó facturación electrónica para Argentina (AFIP).", "success", "medium"],
    ["Capacitación obligatoria", "Curso de facturación electrónica disponible en Academy.", "info", "low"],
  ]
  for (const [title, message, type, priority] of items)
    run("INSERT INTO announcements (id, hotelId, authorId, title, message, type, priority) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, USERS[0]?.id, title, message, type, priority])
  console.log(`announcements: ${items.length} insertados`)
}

// ─── Seed: API KEYS ─────────────────────────────────────────────
function seedApiKeys() {
  const c = (db.query("SELECT COUNT(*) as c FROM api_keys").get() as any).c
  if (c > 0) return console.log("api_keys: ya tiene datos")
  const items = [
    ["Channex Sync", "channels", "chx_••••••••a4f9", 1247, "Hace 45 min"],
    ["Stripe Payments", "billing", "sk_live_••••••••x9y8", 892, "Hace 45 min"],
    ["Google Hotel API", "google-hotel", "ghp_••••••••g7h8", 567, "Hace 2 horas"],
    ["Webhook ManagerHotel", "webhooks", "wh_••••••••k2l3", 234, "Hace 1 hora"],
  ]
  for (const [name, scope, masked, requests, lastUsed] of items)
    run("INSERT INTO api_keys (id, hotelId, name, scope, masked, requests, lastUsed) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, name, scope, masked, requests, lastUsed])
  console.log(`api_keys: ${items.length} insertados`)
}

// ─── Seed: AUDIT LOG ────────────────────────────────────────────
function seedAudit() {
  const c = (db.query("SELECT COUNT(*) as c FROM audit_log").get() as any).c
  if (c > 0) return console.log("audit_log: ya tiene datos")
  const items = [
    [USERS[1]?.name ?? "Juan García", "login", "auth", "", "Inicio de sesión exitoso", "192.168.1.45"],
    [USERS[1]?.name ?? "Juan García", "update", "rooms", ROOMS[0]?.id, "Estado cambiado a disponible", "192.168.1.45"],
    [USERS[2]?.name ?? "María López", "create", "reservations", "", "Nueva reserva creada", "187.56.23.10"],
    [USERS[0]?.name ?? "Admin", "update", "configuration", "", "Tarifas base actualizadas", "201.34.89.22"],
    [USERS[1]?.name ?? "Juan García", "delete", "invoices", "", "Factura anulada", "192.168.1.45"],
  ]
  for (const [userName, action, entity, entityId, detail, ip] of items)
    run("INSERT INTO audit_log (id, hotelId, userName, action, entity, entityId, detail, ip) VALUES (?,?,?,?,?,?,?,?)",
      [uuid(), HID, userName, action, entity, entityId, detail, ip])
  console.log(`audit_log: ${items.length} insertados`)
}

// ─── Seed: GROUPS ───────────────────────────────────────────────
function seedGrupos() {
  const c = (db.query("SELECT COUNT(*) as c FROM groups").get() as any).c
  if (c > 0) return console.log("groups: ya tiene datos")
  const items = [
    ["Bodas García 2026", GUESTS[0]?.id, 8, "2026-07-15", "2026-07-20", "confirmed", 4800, "Grupo bodas — requiere habitaciones contiguas"],
    ["Convención Tech Corp", GUESTS[1]?.id, 12, "2026-08-10", "2026-08-13", "pending", 3600, "Empresa — factura con IVA"],
    ["Familia Rodríguez", GUESTS[2]?.id, 3, "2026-06-25", "2026-06-28", "confirmed", 720, "Reunión familiar"],
    ["Tour Operator Caribbean", GUESTS[3]?.id, 20, "2026-09-01", "2026-09-05", "pending", 6000, "Operador turístico — tarifa neta"],
  ]
  for (const [name, leadGuestId, totalRooms, checkIn, checkOut, status, totalAmount, notes] of items)
    run("INSERT INTO groups (id, hotelId, name, leadGuestId, totalRooms, checkIn, checkOut, status, totalAmount, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [uuid(), HID, name, leadGuestId, totalRooms, checkIn, checkOut, status, totalAmount, notes])
  console.log(`groups: ${items.length} insertados`)
}

// ─── Seed: MAINTENANCE ──────────────────────────────────────────
function seedMantenimiento() {
  const c = (db.query("SELECT COUNT(*) as c FROM maintenance").get() as any).c
  if (c > 0) return console.log("maintenance: ya tiene datos")
  const items = [
    [ROOMS[1]?.number ?? "102", ROOMS[1]?.id, "A/C no enfría", "El aire acondicionado no enfría correctamente.", "hvac", "high", "open", 150],
    [ROOMS[3]?.number ?? "204", ROOMS[3]?.id, "Ducha con poca presión", "Presión de agua baja en la ducha.", "plumbing", "medium", "in_progress", 80],
    [ROOMS[0]?.number ?? "101", ROOMS[0]?.id, "TV sin señal", "Televisor no detecta canales.", "electronics", "low", "open", 0],
    [ROOMS[2]?.number ?? "103", ROOMS[2]?.id, "Cerradura sensible", "La cerradura electrónica falla intermitentemente.", "locks", "medium", "open", 200],
    [ROOMS[4]?.number ?? "205", ROOMS[4]?.id, "Mantenimiento preventivo", "Revisión trimestral programada.", "general", "low", "closed", 50],
  ]
  for (const [roomNumber, roomId, title, description, category, priority, status, estimatedCost] of items)
    run("INSERT INTO maintenance (id, hotelId, roomId, roomNumber, title, description, category, priority, status, estimatedCost, reportedDate) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [uuid(), HID, roomId, roomNumber, title, description, category, priority, status, estimatedCost, now()])
  console.log(`maintenance: ${items.length} insertados`)
}

// ─── Seed: TICKETS (soporte) ────────────────────────────────────
function seedTickets() {
  const c = (db.query("SELECT COUNT(*) as c FROM tickets").get() as any).c
  if (c > 0) return console.log("tickets: ya tiene datos")
  const items = [
    ["Facturación electrónica no genera NCF", USERS[1]?.id, "billing", "high", "open", "Al emitir factura electrónica no se genera el NCF automáticamente."],
    ["Error al sincronizar con Booking.com", USERS[1]?.id, "integration", "medium", "in_progress", "La sincronización de disponibilidad con Booking falla intermitentemente."],
    ["Cómo configurar depósito?", USERS[2]?.id, "query", "low", "open", "Necesito configurar depósito del 30% pero no encuentro la opción."],
  ]
  for (const [subject, userId, category, priority, status, description] of items)
    run("INSERT INTO tickets (id, hotelId, userId, subject, category, priority, status, description) VALUES (?,?,?,?,?,?,?,?)",
      [uuid(), HID, userId, subject, category, priority, status, description])
  console.log(`tickets: ${items.length} insertados`)
}

// ─── Seed: NOTIFICATIONS ────────────────────────────────────────
function seedNotif() {
  const c = (db.query("SELECT COUNT(*) as c FROM notifications").get() as any).c
  if (c > 0) return console.log("notifications: ya tiene datos")
  const items = [
    ["Nueva reserva", "Reserva de Carlos Mendoza — Hab 101 confirmada", "reserva", "info"],
    ["Check-in completado", "María González hizo check-in en Hab 104", "checkin", "success"],
    ["Pago recibido", "Pago de $520 recibido vía Expedia", "pago", "success"],
    ["Mantenimiento urgent", "Ticket A/C Habitación 102 — prioridad alta", "system", "warning"],
  ]
  for (const [title, message, type, priority] of items)
    run("INSERT INTO notifications (id, hotelId, type, title, message, metadata, channel) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, type, title, message, JSON.stringify({ priority }), "app"])
  console.log(`notifications: ${items.length} insertados`)
}

// ─── Seed: CONFIGURATION (per-hotel JSON config) ────────────────
function seedConfig() {
  const c = (db.query("SELECT COUNT(*) as c FROM configuration WHERE hotelId=?").get(HID) as any).c
  if (c > 0) return console.log("configuration: ya tiene datos")
  const cfg: Record<string, any> = {
    metodos_pago: [
      { id: "card", nombre: "Tarjeta Crédito/Débito", icono: "💳", activo: true },
      { id: "cash", nombre: "Efectivo", icono: "💵", activo: true },
      { id: "transfer", nombre: "Transferencia Bancaria", icono: "🏦", activo: true },
      { id: "paypal", nombre: "PayPal", icono: "🅿️", activo: false },
      { id: "link", nombre: "Pago por Link", icono: "🔗", activo: true },
    ],
    politicas_cancelacion: [
      { id: "flexible", nombre: "Flexible", descripcion: "Cancelación gratuita hasta 24h antes." },
      { id: "moderate", nombre: "Moderada", descripcion: "Cancelación gratuita hasta 5 días antes." },
      { id: "strict", nombre: "Estricta", descripcion: "Cancelación gratuita hasta 14 días antes." },
      { id: "non_refundable", nombre: "No Reembolsable", descripcion: "No se aceptan cancelaciones." },
    ],
    temporadas: [
      { nombre: "Alta", icono: "☀️", fechas: "Dic-Abr, Semana Santa", recargo: 25, activo: true },
      { nombre: "Media", icono: "🌤️", fechas: "May, Jun, Nov", recargo: 10, activo: true },
      { nombre: "Baja", icono: "🌧️", fechas: "Jul-Oct", recargo: 0, activo: false },
    ],
    cargos_extra: [
      { nombre: "Cama extra", icono: "🛏️", precio: 25 },
      { nombre: "Mascota", icono: "🐕", precio: 15 },
      { nombre: "Estacionamiento", icono: "🅿️", precio: 10 },
      { nombre: "Lavandería express", icono: "👔", precio: 20 },
    ],
    impuestos: [
      { nombre: "ITBIS", icono: "🇩🇴", etiqueta: "ITBIS (Impuesto)", tasa: 18, activo: true },
      { nombre: "Eco-tasa", icono: "🌿", etiqueta: "Eco-tasa Turística", tasa: 2, activo: true },
      { nombre: "Service", icono: "🍽️", etiqueta: "Service Charge", tasa: 10, activo: false },
    ],
    catalogo_amenities: ["WiFi","TV","A/C","Minibar","Caja fuerte","Plancha","Secador","Bata","Toallas extra","Vista al mar","Balcón"],
  }
  for (const [key, value] of Object.entries(cfg)) {
    run("INSERT INTO configuration (id, hotelId, key, value) VALUES (?,?,?,?) ON CONFLICT(hotelId, key) DO UPDATE SET value=excluded.value",
      [uuid(), HID, key, JSON.stringify(value)])
  }
  console.log(`configuration: ${Object.keys(cfg).length} claves insertadas`)
}

seedPaquetes(); seedDispositivos(); seedAnuncios(); seedApiKeys(); seedAudit()
seedGrupos(); seedMantenimiento(); seedTickets(); seedNotif(); seedConfig()

console.log("\n✅ Migración completa")
db.close()
