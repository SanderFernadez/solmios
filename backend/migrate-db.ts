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

exec(`CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL,
  html TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  maxAttempts INTEGER NOT NULL DEFAULT 3, lastError TEXT, nextRetryAt TEXT, provider TEXT,
  relatedType TEXT, relatedId TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)
exec(`CREATE INDEX IF NOT EXISTS idx_email_queue_status_retry ON email_queue (status, nextRetryAt)`)

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

// ─── AI Receptionist tables ─────────────────────────────────────
exec(`CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT, reservationId TEXT,
  channel TEXT NOT NULL, channelConversationId TEXT, guestPhone TEXT, guestName TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'active', resolvedBy TEXT,
  assignedAgentId TEXT, satisfactionScore REAL, startedAt TEXT NOT NULL,
  endedAt TEXT, lastMessageAt TEXT, intentSummary TEXT, tags TEXT DEFAULT '[]',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY, conversationId TEXT NOT NULL, hotelId TEXT NOT NULL,
  sender TEXT NOT NULL, content TEXT NOT NULL, contentType TEXT DEFAULT 'text',
  mediaUrl TEXT, intentDetected TEXT, confidence REAL,
  actionTaken TEXT, actionResult TEXT, metadata TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS ai_intents (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
  category TEXT DEFAULT 'general', triggerPhrases TEXT NOT NULL,
  responseTemplate TEXT NOT NULL, action TEXT, actionPayload TEXT,
  fallbackResponse TEXT, priority INTEGER DEFAULT 0, confidenceThreshold REAL DEFAULT 0.65,
  requiresAuth INTEGER DEFAULT 0, isSystem INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS ai_templates (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
  category TEXT NOT NULL, trigger TEXT, responseEs TEXT NOT NULL,
  responseEn TEXT, responsePt TEXT, channel TEXT DEFAULT 'all',
  variables TEXT DEFAULT '[]', buttons TEXT, isSystem INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS ai_whatsapp_config (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL UNIQUE,
  connectionMode TEXT DEFAULT 'baileys', connectionStatus TEXT DEFAULT 'disconnected',
  phoneNumberId TEXT, wabaId TEXT, accessToken TEXT, verifyToken TEXT,
  baileysCredentials TEXT, webhookUrl TEXT, isActive INTEGER DEFAULT 0,
  businessHoursStart TEXT DEFAULT '08:00', businessHoursEnd TEXT DEFAULT '22:00',
  businessDays TEXT DEFAULT '[1,2,3,4,5,6,7]', outsideHoursMessage TEXT,
  autoReplyDelay INTEGER DEFAULT 1000, maxAutoRetries INTEGER DEFAULT 3,
  transferAgentPhone TEXT, dailyMessageLimit INTEGER DEFAULT 1000,
  llmProvider TEXT DEFAULT 'deepseek', llmModel TEXT, llmApiKey TEXT, botName TEXT DEFAULT 'Sofía',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS ai_metrics_daily (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, date TEXT NOT NULL,
  totalConversations INTEGER DEFAULT 0, totalMessages INTEGER DEFAULT 0,
  botResolved INTEGER DEFAULT 0, hybridResolved INTEGER DEFAULT 0, agentResolved INTEGER DEFAULT 0,
  escalatedToHuman INTEGER DEFAULT 0, avgConfidence REAL DEFAULT 0, avgResponseTimeMs REAL DEFAULT 0,
  avgSatisfaction REAL DEFAULT 0, topIntents TEXT, topCategories TEXT, messagesByChannel TEXT,
  bookingsGenerated INTEGER DEFAULT 0, upsellsAccepted INTEGER DEFAULT 0, complaintsResolved INTEGER DEFAULT 0)`)

exec(`CREATE TABLE IF NOT EXISTS ai_booking_flows (
  id TEXT PRIMARY KEY, conversationId TEXT NOT NULL, hotelId TEXT NOT NULL,
  step TEXT DEFAULT 'init', checkIn TEXT, checkOut TEXT,
  adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0,
  preferredRoomType TEXT, selectedRoomId TEXT, selectedRoomType TEXT,
  totalAmount REAL DEFAULT 0, currency TEXT DEFAULT 'USD',
  guestName TEXT, guestEmail TEXT, guestPhone TEXT,
  reservationId TEXT, paymentLinkId TEXT, paymentStatus TEXT DEFAULT 'pending',
  upsellsOffered TEXT, completedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS ai_voice_config (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL UNIQUE,
  provider TEXT DEFAULT 'lowcost', phoneNumber TEXT, sipEndpoint TEXT,
  voiceId TEXT DEFAULT 'es-MX-DaliaNeural', welcomeMessage TEXT,
  transferNumber TEXT, maxCallDuration INTEGER DEFAULT 600, isActive INTEGER DEFAULT 0,
  sttModel TEXT DEFAULT 'whisper-large-v3', llmModel TEXT DEFAULT 'deepseek-chat',
  ttsModel TEXT DEFAULT 'edge-tts-es-MX-Dalia',
  openaiApiKey TEXT, livekitUrl TEXT, livekitApiKey TEXT, deepseekApiKey TEXT,
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
    // Configuración de email transaccional (vacía — el admin la completa desde Settings; sin secretos en el repo).
    email_config: {},
    resend_api_key: "",
  }
  for (const [key, value] of Object.entries(cfg)) {
    run("INSERT INTO configuration (id, hotelId, key, value) VALUES (?,?,?,?) ON CONFLICT(hotelId, key) DO UPDATE SET value=excluded.value",
      [uuid(), HID, key, JSON.stringify(value)])
  }
  console.log(`configuration: ${Object.keys(cfg).length} claves insertadas`)
}

seedPaquetes(); seedDispositivos(); seedAnuncios(); seedApiKeys(); seedAudit()
seedGrupos(); seedMantenimiento(); seedTickets(); seedNotif(); seedConfig()

// ─── RRHH: Empleados, Payroll, Attendance ──────────────────────────────
exec(`CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  managerId TEXT, parentId TEXT, active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS employee_profiles (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, hotelId TEXT NOT NULL,
  departmentId TEXT, position TEXT, managerId TEXT, hireDate TEXT,
  salary REAL, contractType TEXT, documentNumber TEXT, documentType TEXT,
  documentExpiry TEXT, address TEXT, city TEXT, country TEXT,
  emergencyContactName TEXT, emergencyContactPhone TEXT, emergencyContactRelation TEXT,
  bankName TEXT, bankAccount TEXT, vacationDaysTotal INTEGER DEFAULT 15,
  vacationDaysUsed INTEGER DEFAULT 0, notes TEXT, active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS employee_contracts (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
  type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT,
  salary REAL NOT NULL, currency TEXT DEFAULT 'USD', position TEXT,
  departmentId TEXT, status TEXT DEFAULT 'active', signedAt TEXT, notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
  type TEXT NOT NULL, name TEXT NOT NULL, fileUrl TEXT,
  expiryDate TEXT, issuedBy TEXT, notes TEXT, alertSent INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
  type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT NOT NULL,
  days REAL NOT NULL, reason TEXT, status TEXT DEFAULT 'pending',
  approvedBy TEXT, approvedAt TEXT, notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS performance_reviews (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
  reviewerId TEXT NOT NULL, period TEXT, reviewDate TEXT NOT NULL,
  score REAL, strengths TEXT, improvements TEXT, goals TEXT, notes TEXT,
  status TEXT DEFAULT 'draft',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── Payroll ───────────────────────────────────────────────────────────
exec(`CREATE TABLE IF NOT EXISTS payroll_config (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL,
  payrollFrequency TEXT DEFAULT 'monthly', payDay INTEGER DEFAULT 30,
  currency TEXT DEFAULT 'USD', createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS payroll_concepts (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
  type TEXT NOT NULL, taxable INTEGER DEFAULT 1, active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, period TEXT NOT NULL,
  startDate TEXT NOT NULL, endDate TEXT NOT NULL, status TEXT DEFAULT 'draft',
  processedAt TEXT, processedBy TEXT, notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS payroll_run_details (
  id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
  baseSalary REAL NOT NULL, additions REAL DEFAULT 0, deductions REAL DEFAULT 0,
  netPay REAL NOT NULL, hoursWorked REAL DEFAULT 0, overtimeHours REAL DEFAULT 0,
  notes TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS payroll_payslips (
  id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
  hotelId TEXT NOT NULL, period TEXT, issueDate TEXT,
  fileUrl TEXT, sent INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS payroll_payment_history (
  id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
  hotelId TEXT NOT NULL, amount REAL NOT NULL, method TEXT DEFAULT 'bank_transfer',
  reference TEXT, paidAt TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── Attendance ────────────────────────────────────────────────────────
exec(`CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
  date TEXT NOT NULL, clockIn TEXT, clockOut TEXT,
  breakStart TEXT, breakEnd TEXT, status TEXT DEFAULT 'present',
  method TEXT DEFAULT 'pin', notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS attendance_schedules (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
  dayOfWeek INTEGER NOT NULL, startTime TEXT NOT NULL, endTime TEXT NOT NULL,
  active INTEGER DEFAULT 1, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── Payments (módulo payments: transacciones, links de pago, depósitos) ──
exec(`CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, folioId TEXT, invoiceId TEXT, guestId TEXT,
  type TEXT NOT NULL, method TEXT NOT NULL, status TEXT DEFAULT 'pending',
  amount REAL NOT NULL, currency TEXT DEFAULT 'USD', description TEXT DEFAULT '',
  reference TEXT DEFAULT '', stripePaymentId TEXT DEFAULT '', stripeSessionId TEXT DEFAULT '',
  metadata TEXT, processedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT, folioId TEXT,
  amount REAL NOT NULL, currency TEXT DEFAULT 'USD', description TEXT DEFAULT '',
  status TEXT DEFAULT 'active', token TEXT NOT NULL, expiresAt TEXT,
  maxUses INTEGER DEFAULT 1, useCount INTEGER DEFAULT 0, paymentId TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, reservationId TEXT, guestId TEXT, roomId TEXT,
  amount REAL NOT NULL, currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'held',
  paymentMethod TEXT DEFAULT 'card', stripePaymentId TEXT DEFAULT '',
  holdReason TEXT DEFAULT 'reservation_guarantee', releasedAt TEXT,
  refundAmount REAL DEFAULT 0, notes TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS attendance_config (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL,
  lateThreshold INTEGER DEFAULT 15, overtimeEnabled INTEGER DEFAULT 1,
  biometricEnabled INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── Seed DEMO: Talento, Nómina, Pagos, Gastos, CRM (Hotel Boutique Palma) ──
// hotelId EXPLÍCITO (no HID) → garantiza el hotel demo donde viven IA/WhatsApp/Stripe.
function seedDemoTalentoFinanzas() {
  const DEMO_HOTEL = (db.prepare('SELECT id FROM hotels WHERE name=?').get('Hotel Boutique Palma') as any)?.id
  if (!DEMO_HOTEL) return console.log('demo talento/finanzas: Hotel Boutique Palma no encontrado, skip')
  const cnt = (t: string) => { try { return (db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE hotelId=?`).get(DEMO_HOTEL) as any).c } catch { return 0 } }

  // Departamentos + perfiles: idempotente (recuperar si ya existen del run anterior)
  let depts = (db.prepare('SELECT id FROM departments WHERE hotelId=?').all(DEMO_HOTEL) as any[]).map((r) => r.id)
  if (depts.length === 0) {
    depts = [
      ['Recepción', 'Front desk y atención al huésped'],
      ['Housekeeping', 'Limpieza y preparación de habitaciones'],
      ['Mantenimiento', 'Conservación y reparaciones'],
    ].map(([name, desc]) => {
      const id = uuid()
      run('INSERT INTO departments (id, hotelId, name, description, active) VALUES (?,?,?,?,1)', [id, DEMO_HOTEL, name, desc])
      return id
    })
  }
  let emps = (db.prepare('SELECT id, salary FROM employee_profiles WHERE hotelId=?').all(DEMO_HOTEL) as any[])
  if (emps.length === 0) {
    emps = [
      [USERS[0]?.id ?? uuid(), depts[0], 'Recepcionista', 1850, 'full_time'],
      [USERS[1]?.id ?? uuid(), depts[0], 'Supervisor de Recepción', 2400, 'full_time'],
      [USERS[2]?.id ?? uuid(), depts[1], 'Camarera de piso', 950, 'part_time'],
      [USERS[3]?.id ?? uuid(), depts[2], 'Técnico de mantenimiento', 1500, 'full_time'],
    ].map(([userId, deptId, position, salary, contract]) => {
      const id = uuid()
      run('INSERT INTO employee_profiles (id, userId, hotelId, departmentId, position, hireDate, salary, contractType, active) VALUES (?,?,?,?,?,?,?,?,1)',
        [id, userId, DEMO_HOTEL, deptId, position, '2025-03-01', salary, contract])
      return { id, salary: salary as number }
    })
  }

  if (cnt('payroll_runs') === 0) {
    const runId = uuid()
    run('INSERT INTO payroll_runs (id, hotelId, period, startDate, endDate, paymentDate, status) VALUES (?,?,?,?,?,?,?)',
      [runId, DEMO_HOTEL, '2026-06', '2026-06-01', '2026-06-30', '2026-06-30', 'processed'])
    for (const e of emps)
      run('INSERT INTO payroll_run_details (id, runId, employeeId, baseSalary, additions, deductions, netPay, hoursWorked) VALUES (?,?,?,?,?,?,?,?)',
        [uuid(), runId, e.id, e.salary ?? 0, 0, 0, Math.round((e.salary ?? 0) * 0.9), 160])
  }
  if (cnt('attendance_records') === 0)
    for (const e of emps)
      run('INSERT INTO attendance_records (id, hotelId, employeeId, date, clockIn, clockOut, status, method) VALUES (?,?,?,?,?,?,?,?)',
        [uuid(), DEMO_HOTEL, e.id, '2026-06-26', '08:00', '16:00', 'present', 'pin'])
  if (cnt('payments') === 0)
    for (const [type, method, status, amount, desc] of [
      ['charge', 'card', 'completed', 320, 'Reserva fin de semana'],
      ['charge', 'transfer', 'completed', 480, 'Pago grupo corporativo'],
      ['deposit', 'link', 'pending', 150, 'Anticipo reserva'],
    ] as const)
      run('INSERT INTO payments (id, hotelId, type, method, status, amount, currency, description, processedAt) VALUES (?,?,?,?,?,?,?,?,?)',
        [uuid(), DEMO_HOTEL, type, method, status, amount, 'USD', desc, status === 'pending' ? null : '2026-06-26'])
  if (cnt('expenses') === 0)
    for (const [cat, concept, amount, provider, paid] of [
      ['supplies', 'Insumos de limpieza', 180, 'CleanCo', true],
      ['utilities', 'Electricidad', 540, 'Edenor', true],
      ['maintenance', 'Repuestos A/C', 95, 'RefriShop', false],
    ] as const)
      run('INSERT INTO expenses (id, hotelId, category, concept, amount, date, provider, paid) VALUES (?,?,?,?,?,?,?,?)',
        [uuid(), DEMO_HOTEL, cat, concept, amount, '2026-06-25', provider, paid ? 1 : 0])
  if (cnt('coupons') === 0)
    for (const [code, type, value, minP, maxU, start, end] of [
      ['VERANO10', 'percent', 10, 0, 100, '2026-06-01', '2026-09-30'],
      ['FIESTA50', 'fixed', 50, 300, 50, '2026-06-01', '2026-12-31'],
      ['FINDE15', 'percent', 15, 0, 200, '2026-06-01', '2026-08-31'],
    ] as const)
      run('INSERT INTO coupons (id, hotelId, code, type, value, minPurchase, maxUses, startsAt, expiresAt, active) VALUES (?,?,?,?,?,?,?,?,?,1)',
        [uuid(), DEMO_HOTEL, code, type, value, minP, maxU, start, end])

  if (cnt('roles') === 0)
    for (const [name, icon, color, perms] of [
      ['Recepcionista', '🔑', 'bg-blue/20 text-blue', '["reservations.admin","guests.admin","checkin.admin"]'],
      ['Gerente', '👔', 'bg-violet/20 text-violet', '["reservations.admin","rooms.admin","billing.admin","reports.admin"]'],
      ['Housekeeping', '🧹', 'bg-green/20 text-green', '["housekeeping.admin"]'],
    ] as const)
      run('INSERT INTO roles (id, hotelId, name, icon, color, system, permissions, users) VALUES (?,?,?,?,?,?,?,0)',
        [uuid(), DEMO_HOTEL, name, icon, color, 0, perms])

  console.log('demo talento/finanzas: seed completo (idempotente)')
}

// ─── CRM ───────────────────────────────────────────────────────────────
exec(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT NOT NULL,
  type TEXT NOT NULL, points INTEGER NOT NULL, description TEXT,
  reservationId TEXT, createdAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, value REAL NOT NULL, minPurchase REAL DEFAULT 0,
  maxUses INTEGER DEFAULT 100, usedCount INTEGER DEFAULT 0,
  startsAt TEXT, expiresAt TEXT, active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

exec(`CREATE TABLE IF NOT EXISTS guest_segments (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
  criteria TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── Marketing ─────────────────────────────────────────────────────────
exec(`CREATE TABLE IF NOT EXISTS auto_messages (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL,
  title TEXT NOT NULL, color TEXT DEFAULT '#3b82f6',
  emailSubject TEXT, emailBody TEXT, whatsappBody TEXT,
  channel TEXT DEFAULT 'email', triggerEvent TEXT NOT NULL DEFAULT 'checkin_day',
  triggerOffset INTEGER DEFAULT 0, variables TEXT DEFAULT '[]',
  isActive INTEGER DEFAULT 1,
  event TEXT, language TEXT DEFAULT 'es', triggerType TEXT DEFAULT 'cron',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ALTER idempotente: auto_messages += event/language/triggerType (spec 11.1.6 — notification templates configurable + i18n).
const amCols = db.query("PRAGMA table_info(auto_messages)").all() as any[]
if (!amCols.some((c: any) => c.name === 'event')) exec("ALTER TABLE auto_messages ADD COLUMN event TEXT")
if (!amCols.some((c: any) => c.name === 'language')) exec("ALTER TABLE auto_messages ADD COLUMN language TEXT DEFAULT 'es'")
if (!amCols.some((c: any) => c.name === 'triggerType')) exec("ALTER TABLE auto_messages ADD COLUMN triggerType TEXT DEFAULT 'cron'")

// ALTER idempotente: guests += language (spec 11.1.6 — idioma del huésped para resolver plantilla i18n).
const gCols = db.query("PRAGMA table_info(guests)").all() as any[]
if (!gCols.some((c: any) => c.name === 'language')) exec("ALTER TABLE guests ADD COLUMN language TEXT")

exec(`CREATE TABLE IF NOT EXISTS message_logs (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, reservationId TEXT,
  guestId TEXT, channel TEXT NOT NULL, content TEXT, status TEXT,
  sentAt TEXT, createdAt TEXT DEFAULT (datetime('now')))`)

// ALTER idempotente: columna recipient en message_logs (spec 11.1.1 — log de email de check-in con destinatario).
const msgCols = db.query("PRAGMA table_info(message_logs)").all() as any[]
if (!msgCols.some((c: any) => c.name === 'recipient')) {
  exec("ALTER TABLE message_logs ADD COLUMN recipient TEXT")
}

// ALTER idempotente: reservations += condiciones + otros cobros (F3 match-misterplan).
const rCols = db.query("PRAGMA table_info(reservations)").all() as any[]
if (!rCols.some((c: any) => c.name === 'gdprAccepted')) exec("ALTER TABLE reservations ADD COLUMN gdprAccepted INTEGER DEFAULT 0")
if (!rCols.some((c: any) => c.name === 'marketingAccepted')) exec("ALTER TABLE reservations ADD COLUMN marketingAccepted INTEGER DEFAULT 0")
if (!rCols.some((c: any) => c.name === 'termsAccepted')) exec("ALTER TABLE reservations ADD COLUMN termsAccepted INTEGER DEFAULT 0")
if (!rCols.some((c: any) => c.name === 'otherCharges')) exec("ALTER TABLE reservations ADD COLUMN otherCharges REAL DEFAULT 0")
// Tarjeta de garantía (MisterPlan): datos parciales + bandera. No se guarda número completo ni CVV.
if (!rCols.some((c: any) => c.name === 'hasGuaranteeCard')) exec("ALTER TABLE reservations ADD COLUMN hasGuaranteeCard INTEGER DEFAULT 0")
if (!rCols.some((c: any) => c.name === 'cardHolder')) exec("ALTER TABLE reservations ADD COLUMN cardHolder TEXT")
if (!rCols.some((c: any) => c.name === 'cardBrand')) exec("ALTER TABLE reservations ADD COLUMN cardBrand TEXT")
if (!rCols.some((c: any) => c.name === 'cardLast4')) exec("ALTER TABLE reservations ADD COLUMN cardLast4 TEXT")
if (!rCols.some((c: any) => c.name === 'cardExpMonth')) exec("ALTER TABLE reservations ADD COLUMN cardExpMonth TEXT")
if (!rCols.some((c: any) => c.name === 'cardExpYear')) exec("ALTER TABLE reservations ADD COLUMN cardExpYear TEXT")

// CREATE: reservation_addons (F3 match-misterplan — otros servicios y descuentos por reserva).
exec(`CREATE TABLE IF NOT EXISTS reservation_addons (
  id TEXT PRIMARY KEY, reservationId TEXT NOT NULL, hotelId TEXT NOT NULL,
  description TEXT, kind TEXT DEFAULT 'service', amount REAL DEFAULT 0, quantity INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// Seed idempotente: currency_config por defecto para todos los hoteles (F3 — conversión de moneda).
// Secondary DOP @ 60. UNIQUE(hotelId,key) → no duplica. Editable desde /panel/settings.
try {
  db.exec(`INSERT OR IGNORE INTO configuration (id, hotelId, key, value, updatedAt)
    SELECT lower(hex(randomblob(16))), id, 'currency_config', '{"secondaryCurrency":"DOP","exchangeRate":60}', datetime('now') FROM hotels`)
} catch { /* hotels puede no existir en runs tempranos — seguro */ }

exec(`CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
  language TEXT DEFAULT 'es', templateId TEXT, body TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

// ─── M17 Gerente IA: historial de interacciones del gerente ──────────────
exec(`CREATE TABLE IF NOT EXISTS ai_manager_interactions (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT NOT NULL,
  query TEXT NOT NULL, response TEXT NOT NULL, queryType TEXT,
  dataSourcesUsed TEXT, confidence REAL, feedback TEXT, responseTimeMs INTEGER,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`)

try { seedDemoTalentoFinanzas() } catch (e: any) { console.log('demo talento/finanzas: parcial —', String(e?.message || e).slice(0, 90)) }

console.log("\n✅ Migración completa")
db.close()
