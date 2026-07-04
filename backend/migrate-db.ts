// migrate-db.ts — UNIVERSAL (PostgreSQL + SQLite vía DbAdapter del framework).
// No depende de bun:sqlite directamente: usa el mismo adapter condicional que
// composition-root.ts, elegido por DATABASE_URL (Postgres) o DB_PATH (SQLite).
// Tablas y columnas en INGLÉS (regla DB English Only del CLAUDE.md). Idempotente.
//
// Nota de portabilidad: se eliminaron todos los DEFAULT (datetime('now')) de los
// DDL (SQLite-only) y los PRAGMA*. Las columnas createdAt/updatedAt quedan como
// TEXT sin default; los INSERT del seed no siempre las setean → quedarán NULL en
// datos demo (aceptable). El app real setea timestamps desde sus servicios.
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'

// ─── Adapter condicional (mismo criterio que composition-root.ts) ──────────
const DATABASE_URL = process.env.DATABASE_URL
// La interfaz DbAdapter del framework expone query/run/close pero NO connect().
// Ambos adapters concretos (SqliteAdapter/PostgresAdapter) implementan connect() y
// requieren ser conectados antes del primer query → tipamos como intersección.
const db: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({
      path: process.env.DB_PATH || './data/managerhotel.db',
      wal: true,
      foreignKeys: true,
    })

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

// ─── Tipos mínimos para filas (evitar `any`) ───────────────────────────────
interface UserRow { id: string; name: string; email: string; role: string }
interface RoomRow { id: string; number: string; type: string }
interface GuestRow { id: string; name: string }
interface CountRow { c: number }

// Resueltos en runtime (main) — disponibles para los seeds.
let HID: string | undefined
let USERS: UserRow[] = []
let ROOMS: RoomRow[] = []
let GUESTS: GuestRow[] = []

// ─── Helpers universales (async sobre DbAdapter) ───────────────────────────
// DDL/CREATE: ignora errores de "ya existe" (defensivo; IF NOT EXISTS ya protege).
async function exec(sql: string): Promise<void> {
  try {
    await db.run(sql)
  } catch (e: unknown) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
    // SQLite: "already exists" | Postgres: 'already exists'
    if (!msg.includes('already exists')) throw e
  }
}

// ALTER TABLE ADD COLUMN portátil: reintenta el ALTER y descarta el error cuando
// la columna ya existe (SQLite: "duplicate column name" | Postgres: "already exists").
// Reemplaza los antiguos PRAGMA table_info(...) del código SQLite-only.
async function addColumnIfMissing(table: string, column: string, def: string): Promise<void> {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
  } catch (e: unknown) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
    if (!msg.includes('already exists') && !msg.includes('duplicate column')) throw e
  }
}

// INSERT/UPDATE/DELETE — adapter.run(sql, params[]). Helper async.
async function run(sql: string, params: unknown[] = []): Promise<void> {
  await db.run(sql, params)
}

// COUNT(*) portable: SELECT ... as c → rows[0].c
async function countRows(sql: string, params: unknown[] = []): Promise<number> {
  const rows = (await db.query(sql, params)) as CountRow[]
  return rows[0]?.c ?? 0
}

// ─── Tablas (DDL en inglés, idempotente) ────────────────────────
async function createTablesBlock1(): Promise<void> {
  await exec(`CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
    type TEXT DEFAULT 'upsell', price REAL NOT NULL, contents TEXT DEFAULT '[]',
    active INTEGER DEFAULT 1, createdAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY, hotelId TEXT, userId TEXT, userName TEXT,
    device TEXT, icon TEXT DEFAULT '🖥️', browser TEXT, os TEXT,
    ip TEXT, isMobile INTEGER DEFAULT 0, lastActivity TEXT, createdAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY, hotelId TEXT, authorId TEXT, title TEXT NOT NULL, message TEXT,
    type TEXT DEFAULT 'info', priority TEXT DEFAULT 'medium', active INTEGER DEFAULT 1,
    date TEXT, createdAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY, hotelId TEXT, name TEXT NOT NULL, scope TEXT,
    masked TEXT, secretHash TEXT, active INTEGER DEFAULT 1, requests INTEGER DEFAULT 0,
    lastUsed TEXT, createdAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, hotelId TEXT, userId TEXT, userName TEXT,
    action TEXT NOT NULL, entity TEXT, entityId TEXT, detail TEXT, ip TEXT, createdAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS configuration (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, key TEXT NOT NULL, value TEXT DEFAULT '{}',
    updatedAt TEXT, UNIQUE(hotelId, key))`)
  // El modelo ORM (models.ts Configuration) solo declara key: { indexed: true }, sin unique
  // compuesto (hotelId, key). ormMigrate crea la tabla PRIMERO sin ese constraint, y al correr
  // después este CREATE TABLE IF NOT EXISTS la saltea → el UNIQUE nunca se aplica y los UPSERTs
  // ON CONFLICT(hotelId, key) del seeder fallan. Lo garantizamos vía índice único idempotente
  // (portable SQLite + Postgres). Si la tabla ya tiene el UNIQUE (DBs creadas por migrate legacy),
  // IF NOT EXISTS lo saltea sin error.
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_configuration_hotel_key ON configuration(hotelId, key)`)

  await exec(`CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL,
    html TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    maxAttempts INTEGER NOT NULL DEFAULT 3, lastError TEXT, nextRetryAt TEXT, provider TEXT,
    relatedType TEXT, relatedId TEXT, createdAt TEXT, updatedAt TEXT)`)
  await exec(`CREATE INDEX IF NOT EXISTS idx_email_queue_status_retry ON email_queue (status, nextRetryAt)`)

  await exec(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, leadGuestId TEXT,
    totalRooms INTEGER DEFAULT 1, checkIn TEXT, checkOut TEXT, status TEXT DEFAULT 'pendiente',
    totalAmount REAL DEFAULT 0, notes TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, roomId TEXT, roomNumber TEXT,
    title TEXT NOT NULL, description TEXT, category TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'open', assignedTo TEXT,
    estimatedCost REAL DEFAULT 0, reportedDate TEXT, resolvedDate TEXT,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT NOT NULL,
    subject TEXT NOT NULL, category TEXT DEFAULT 'technical', priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open', description TEXT, attachments TEXT,
    assignedTo TEXT, slaStatus TEXT, slaBreached INTEGER DEFAULT 0, messages TEXT DEFAULT '[]',
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT, type TEXT DEFAULT 'sistema',
    title TEXT NOT NULL, message TEXT, read INTEGER DEFAULT 0, sent INTEGER DEFAULT 0,
    date TEXT, channel TEXT, metadata TEXT, createdAt TEXT, updatedAt TEXT)`)

  // ─── AI Receptionist tables ─────────────────────────────────────
  await exec(`CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT, reservationId TEXT,
    channel TEXT NOT NULL, channelConversationId TEXT, guestPhone TEXT, guestName TEXT,
    language TEXT DEFAULT 'es', status TEXT DEFAULT 'active', resolvedBy TEXT,
    assignedAgentId TEXT, satisfactionScore REAL, startedAt TEXT NOT NULL,
    endedAt TEXT, lastMessageAt TEXT, intentSummary TEXT, tags TEXT DEFAULT '[]',
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY, conversationId TEXT NOT NULL, hotelId TEXT NOT NULL,
    sender TEXT NOT NULL, content TEXT NOT NULL, contentType TEXT DEFAULT 'text',
    mediaUrl TEXT, intentDetected TEXT, confidence REAL,
    actionTaken TEXT, actionResult TEXT, metadata TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_intents (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    category TEXT DEFAULT 'general', triggerPhrases TEXT NOT NULL,
    responseTemplate TEXT NOT NULL, action TEXT, actionPayload TEXT,
    fallbackResponse TEXT, priority INTEGER DEFAULT 0, confidenceThreshold REAL DEFAULT 0.65,
    requiresAuth INTEGER DEFAULT 0, isSystem INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_templates (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    category TEXT NOT NULL, trigger TEXT, responseEs TEXT NOT NULL,
    responseEn TEXT, responsePt TEXT, channel TEXT DEFAULT 'all',
    variables TEXT DEFAULT '[]', buttons TEXT, isSystem INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_whatsapp_config (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL UNIQUE,
    connectionMode TEXT DEFAULT 'baileys', connectionStatus TEXT DEFAULT 'disconnected',
    phoneNumberId TEXT, wabaId TEXT, accessToken TEXT, verifyToken TEXT,
    baileysCredentials TEXT, webhookUrl TEXT, isActive INTEGER DEFAULT 0,
    businessHoursStart TEXT DEFAULT '08:00', businessHoursEnd TEXT DEFAULT '22:00',
    businessDays TEXT DEFAULT '[1,2,3,4,5,6,7]', outsideHoursMessage TEXT,
    autoReplyDelay INTEGER DEFAULT 1000, maxAutoRetries INTEGER DEFAULT 3,
    transferAgentPhone TEXT, dailyMessageLimit INTEGER DEFAULT 1000,
    llmProvider TEXT DEFAULT 'deepseek', llmModel TEXT, llmApiKey TEXT, botName TEXT DEFAULT 'Sofía',
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_metrics_daily (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, date TEXT NOT NULL,
    totalConversations INTEGER DEFAULT 0, totalMessages INTEGER DEFAULT 0,
    botResolved INTEGER DEFAULT 0, hybridResolved INTEGER DEFAULT 0, agentResolved INTEGER DEFAULT 0,
    escalatedToHuman INTEGER DEFAULT 0, avgConfidence REAL DEFAULT 0, avgResponseTimeMs REAL DEFAULT 0,
    avgSatisfaction REAL DEFAULT 0, topIntents TEXT, topCategories TEXT, messagesByChannel TEXT,
    bookingsGenerated INTEGER DEFAULT 0, upsellsAccepted INTEGER DEFAULT 0, complaintsResolved INTEGER DEFAULT 0)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_booking_flows (
    id TEXT PRIMARY KEY, conversationId TEXT NOT NULL, hotelId TEXT NOT NULL,
    step TEXT DEFAULT 'init', checkIn TEXT, checkOut TEXT,
    adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0,
    preferredRoomType TEXT, selectedRoomId TEXT, selectedRoomType TEXT,
    totalAmount REAL DEFAULT 0, currency TEXT DEFAULT 'USD',
    guestName TEXT, guestEmail TEXT, guestPhone TEXT,
    reservationId TEXT, paymentLinkId TEXT, paymentStatus TEXT DEFAULT 'pending',
    upsellsOffered TEXT, completedAt TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS ai_voice_config (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL UNIQUE,
    provider TEXT DEFAULT 'lowcost', phoneNumber TEXT, sipEndpoint TEXT,
    voiceId TEXT DEFAULT 'es-MX-DaliaNeural', welcomeMessage TEXT,
    transferNumber TEXT, maxCallDuration INTEGER DEFAULT 600, isActive INTEGER DEFAULT 0,
    sttModel TEXT DEFAULT 'whisper-large-v3', llmModel TEXT DEFAULT 'deepseek-chat',
    ttsModel TEXT DEFAULT 'edge-tts-es-MX-Dalia',
    openaiApiKey TEXT, livekitUrl TEXT, livekitApiKey TEXT, deepseekApiKey TEXT,
    createdAt TEXT, updatedAt TEXT)`)
}

// ─── Seed: PACKAGES ─────────────────────────────────────────────
async function seedPaquetes(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM packages")
  if (c > 0) return console.log("packages: ya tiene datos")
  const items: Array<[string, string, string, number, string]> = [
    ["Suite Romántica", "Decoración floral, champagne, cena para 2", "upsell", 85, '["Botella de champagne","Pétalos de rosa","Cena romántica","Late check-out"]'],
    ["Spa & Bienestar", "Masaje pareja + acceso al spa", "combo", 120, '["Masaje pareja 60min","Sauna","Desayuno saludable"]'],
    ["Airport Transfer", "Traslado privado ida y vuelta", "service", 45, '["Traslado privado","Conductor bilingüe"]'],
    ["Tour Local", "Excursión guiada por la zona", "combo", 65, '["Guía certificado","Transporte","Almuerzo típico"]'],
    ["Late Check-out", "Salida hasta las 18:00", "upsell", 25, '["Check-out extendido 18:00"]'],
  ]
  for (const [name, description, type, price, contents] of items)
    await run("INSERT INTO packages (id, hotelId, name, description, type, price, contents) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, name, description, type, price, contents])
  console.log(`packages: ${items.length} insertados`)
}

// ─── Seed: DEVICES ──────────────────────────────────────────────
async function seedDispositivos(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM devices")
  if (c > 0) return console.log("devices: ya tiene datos")
  const sessions: Array<[string, string, string, string, string, string, number, string]> = [
    [USERS[2]?.name ?? "María López", "iPhone 15", "📱", "Safari 18", "iOS 18.4", "187.56.23.10", 1, "Hace 15 min"],
    [USERS[1]?.name ?? "Juan García", "Desktop PC", "🖥️", "Chrome 132", "Windows 11", "192.168.1.45", 0, "Ahora"],
    [USERS[0]?.name ?? "Super Admin", "MacBook Pro", "💻", "Chrome 132", "macOS 15", "201.34.89.22", 0, "Hace 3 min"],
    ["Ana Torres", "iPad Pro", "📲", "Safari 18", "iPadOS 18.4", "110.23.88.34", 1, "Hace 3 horas"],
    ["Pedro Méndez", "Desktop Dell", "🖥️", "Firefox 135", "Ubuntu 24", "91.56.12.90", 0, "Ayer, 18:30"],
  ]
  for (const [userName, device, icon, browser, os, ip, isMobile, lastActivity] of sessions)
    await run("INSERT INTO devices (id, hotelId, userName, device, icon, browser, os, ip, isMobile, lastActivity) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [uuid(), HID, userName, device, icon, browser, os, ip, isMobile, lastActivity])
  console.log(`devices: ${sessions.length} insertados`)
}

// ─── Seed: ANNOUNCEMENTS ────────────────────────────────────────
async function seedAnuncios(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM announcements")
  if (c > 0) return console.log("announcements: ya tiene datos")
  const items: Array<[string, string, string, string]> = [
    ["Mantenimiento programado", "El sistema estará disponible el domingo 3-5 AM por mantenimiento.", "warning", "high"],
    ["Nueva versión disponible", "Se agregó facturación electrónica para Argentina (AFIP).", "success", "medium"],
    ["Capacitación obligatoria", "Curso de facturación electrónica disponible en Academy.", "info", "low"],
  ]
  for (const [title, message, type, priority] of items)
    await run("INSERT INTO announcements (id, hotelId, authorId, title, message, type, priority) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, USERS[0]?.id, title, message, type, priority])
  console.log(`announcements: ${items.length} insertados`)
}

// ─── Seed: API KEYS ─────────────────────────────────────────────
async function seedApiKeys(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM api_keys")
  if (c > 0) return console.log("api_keys: ya tiene datos")
  const items: Array<[string, string, string, number, string]> = [
    ["Channex Sync", "channels", "chx_••••••••a4f9", 1247, "Hace 45 min"],
    ["Stripe Payments", "billing", "sk_live_••••••••x9y8", 892, "Hace 45 min"],
    ["Google Hotel API", "google-hotel", "ghp_••••••••g7h8", 567, "Hace 2 horas"],
    ["Webhook ManagerHotel", "webhooks", "wh_••••••••k2l3", 234, "Hace 1 hora"],
  ]
  for (const [name, scope, masked, requests, lastUsed] of items)
    await run("INSERT INTO api_keys (id, hotelId, name, scope, masked, requests, lastUsed) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, name, scope, masked, requests, lastUsed])
  console.log(`api_keys: ${items.length} insertados`)
}

// ─── Seed: AUDIT LOG ────────────────────────────────────────────
async function seedAudit(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM audit_log")
  if (c > 0) return console.log("audit_log: ya tiene datos")
  const items: Array<[string, string, string, string | undefined, string, string]> = [
    [USERS[1]?.name ?? "Juan García", "login", "auth", "", "Inicio de sesión exitoso", "192.168.1.45"],
    [USERS[1]?.name ?? "Juan García", "update", "rooms", ROOMS[0]?.id, "Estado cambiado a disponible", "192.168.1.45"],
    [USERS[2]?.name ?? "María López", "create", "reservations", "", "Nueva reserva creada", "187.56.23.10"],
    [USERS[0]?.name ?? "Admin", "update", "configuration", "", "Tarifas base actualizadas", "201.34.89.22"],
    [USERS[1]?.name ?? "Juan García", "delete", "invoices", "", "Factura anulada", "192.168.1.45"],
  ]
  for (const [userName, action, entity, entityId, detail, ip] of items)
    await run("INSERT INTO audit_log (id, hotelId, userName, action, entity, entityId, detail, ip) VALUES (?,?,?,?,?,?,?,?)",
      [uuid(), HID, userName, action, entity, entityId, detail, ip])
  console.log(`audit_log: ${items.length} insertados`)
}

// ─── Seed: GROUPS ───────────────────────────────────────────────
async function seedGrupos(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM groups")
  if (c > 0) return console.log("groups: ya tiene datos")
  const items: Array<[string, string | undefined, number, string, string, string, number, string]> = [
    ["Bodas García 2026", GUESTS[0]?.id, 8, "2026-07-15", "2026-07-20", "confirmed", 4800, "Grupo bodas — requiere habitaciones contiguas"],
    ["Convención Tech Corp", GUESTS[1]?.id, 12, "2026-08-10", "2026-08-13", "pending", 3600, "Empresa — factura con IVA"],
    ["Familia Rodríguez", GUESTS[2]?.id, 3, "2026-06-25", "2026-06-28", "confirmed", 720, "Reunión familiar"],
    ["Tour Operator Caribbean", GUESTS[3]?.id, 20, "2026-09-01", "2026-09-05", "pending", 6000, "Operador turístico — tarifa neta"],
  ]
  for (const [name, leadGuestId, totalRooms, checkIn, checkOut, status, totalAmount, notes] of items)
    await run("INSERT INTO groups (id, hotelId, name, leadGuestId, totalRooms, checkIn, checkOut, status, totalAmount, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [uuid(), HID, name, leadGuestId, totalRooms, checkIn, checkOut, status, totalAmount, notes])
  console.log(`groups: ${items.length} insertados`)
}

// ─── Seed: MAINTENANCE ──────────────────────────────────────────
async function seedMantenimiento(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM maintenance")
  if (c > 0) return console.log("maintenance: ya tiene datos")
  const items: Array<[string | undefined, string | undefined, string, string, string, string, string, number]> = [
    [ROOMS[1]?.number ?? "102", ROOMS[1]?.id, "A/C no enfría", "El aire acondicionado no enfría correctamente.", "hvac", "high", "open", 150],
    [ROOMS[3]?.number ?? "204", ROOMS[3]?.id, "Ducha con poca presión", "Presión de agua baja en la ducha.", "plumbing", "medium", "in_progress", 80],
    [ROOMS[0]?.number ?? "101", ROOMS[0]?.id, "TV sin señal", "Televisor no detecta canales.", "electronics", "low", "open", 0],
    [ROOMS[2]?.number ?? "103", ROOMS[2]?.id, "Cerradura sensible", "La cerradura electrónica falla intermitentemente.", "locks", "medium", "open", 200],
    [ROOMS[4]?.number ?? "205", ROOMS[4]?.id, "Mantenimiento preventivo", "Revisión trimestral programada.", "general", "low", "closed", 50],
  ]
  for (const [roomNumber, roomId, title, description, category, priority, status, estimatedCost] of items)
    await run("INSERT INTO maintenance (id, hotelId, roomId, roomNumber, title, description, category, priority, status, estimatedCost, reportedDate) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [uuid(), HID, roomId, roomNumber, title, description, category, priority, status, estimatedCost, now()])
  console.log(`maintenance: ${items.length} insertados`)
}

// ─── Seed: TICKETS (soporte) ────────────────────────────────────
async function seedTickets(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM tickets")
  if (c > 0) return console.log("tickets: ya tiene datos")
  const items: Array<[string, string | undefined, string, string, string, string]> = [
    ["Facturación electrónica no genera NCF", USERS[1]?.id, "billing", "high", "open", "Al emitir factura electrónica no se genera el NCF automáticamente."],
    ["Error al sincronizar con Booking.com", USERS[1]?.id, "integration", "medium", "in_progress", "La sincronización de disponibilidad con Booking falla intermitentemente."],
    ["Cómo configurar depósito?", USERS[2]?.id, "query", "low", "open", "Necesito configurar depósito del 30% pero no encuentro la opción."],
  ]
  for (const [subject, userId, category, priority, status, description] of items)
    await run("INSERT INTO tickets (id, hotelId, userId, subject, category, priority, status, description) VALUES (?,?,?,?,?,?,?,?)",
      [uuid(), HID, userId, subject, category, priority, status, description])
  console.log(`tickets: ${items.length} insertados`)
}

// ─── Seed: NOTIFICATIONS ────────────────────────────────────────
async function seedNotif(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM notifications")
  if (c > 0) return console.log("notifications: ya tiene datos")
  const items: Array<[string, string, string, string]> = [
    ["Nueva reserva", "Reserva de Carlos Mendoza — Hab 101 confirmada", "reserva", "info"],
    ["Check-in completado", "María González hizo check-in en Hab 104", "checkin", "success"],
    ["Pago recibido", "Pago de $520 recibido vía Expedia", "pago", "success"],
    ["Mantenimiento urgent", "Ticket A/C Habitación 102 — prioridad alta", "system", "warning"],
  ]
  for (const [title, message, type, priority] of items)
    await run("INSERT INTO notifications (id, hotelId, type, title, message, metadata, channel) VALUES (?,?,?,?,?,?,?)",
      [uuid(), HID, type, title, message, JSON.stringify({ priority }), "app"])
  console.log(`notifications: ${items.length} insertados`)
}

// ─── Seed: CONFIGURATION (per-hotel JSON config) ────────────────
async function seedConfig(): Promise<void> {
  const c = await countRows("SELECT COUNT(*) as c FROM configuration WHERE hotelId=?", [HID])
  if (c > 0) return console.log("configuration: ya tiene datos")
  const cfg: Record<string, unknown> = {
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
    catalogo_amenities: ["WiFi", "TV", "A/C", "Minibar", "Caja fuerte", "Plancha", "Secador", "Bata", "Toallas extra", "Vista al mar", "Balcón"],
    // Configuración de email transaccional (vacía — el admin la completa desde Settings; sin secretos en el repo).
    email_config: {},
    resend_api_key: "",
  }
  // UPSERT estándar (ON CONFLICT) — soportado por SQLite 3.24+ y PostgreSQL 9.5+.
  for (const [key, value] of Object.entries(cfg)) {
    await run("INSERT INTO configuration (id, hotelId, key, value, updatedAt) VALUES (?,?,?,?,?) ON CONFLICT(hotelId, key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [uuid(), HID, key, JSON.stringify(value), now()])
  }
  console.log(`configuration: ${Object.keys(cfg).length} claves insertadas`)
}

// ─── RRHH / Payroll / Attendance / Payments DDL ─────────────────────────
async function createTablesBlock2(): Promise<void> {
  await exec(`CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
    managerId TEXT, parentId TEXT, active INTEGER DEFAULT 1, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS employee_profiles (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, hotelId TEXT NOT NULL,
    departmentId TEXT, position TEXT, managerId TEXT, hireDate TEXT,
    salary REAL, contractType TEXT, documentNumber TEXT, documentType TEXT,
    documentExpiry TEXT, address TEXT, city TEXT, country TEXT,
    emergencyContactName TEXT, emergencyContactPhone TEXT, emergencyContactRelation TEXT,
    bankName TEXT, bankAccount TEXT, vacationDaysTotal INTEGER DEFAULT 15,
    vacationDaysUsed INTEGER DEFAULT 0, notes TEXT, active INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS employee_contracts (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT,
    salary REAL NOT NULL, currency TEXT DEFAULT 'USD', position TEXT,
    departmentId TEXT, status TEXT DEFAULT 'active', signedAt TEXT, notes TEXT,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    type TEXT NOT NULL, name TEXT NOT NULL, fileUrl TEXT,
    expiryDate TEXT, issuedBy TEXT, notes TEXT, alertSent INTEGER DEFAULT 0,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT NOT NULL,
    days REAL NOT NULL, reason TEXT, status TEXT DEFAULT 'pending',
    approvedBy TEXT, approvedAt TEXT, notes TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS performance_reviews (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    reviewerId TEXT NOT NULL, period TEXT, reviewDate TEXT NOT NULL,
    score REAL, strengths TEXT, improvements TEXT, goals TEXT, notes TEXT,
    status TEXT DEFAULT 'draft', createdAt TEXT, updatedAt TEXT)`)

  // ─── Payroll ───────────────────────────────────────────────────────────
  await exec(`CREATE TABLE IF NOT EXISTS payroll_config (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL,
    payrollFrequency TEXT DEFAULT 'monthly', payDay INTEGER DEFAULT 30,
    currency TEXT DEFAULT 'USD', createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS payroll_concepts (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    type TEXT NOT NULL, taxable INTEGER DEFAULT 1, active INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, period TEXT NOT NULL,
    startDate TEXT NOT NULL, endDate TEXT NOT NULL, status TEXT DEFAULT 'draft',
    processedAt TEXT, processedBy TEXT, notes TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS payroll_run_details (
    id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
    baseSalary REAL NOT NULL, additions REAL DEFAULT 0, deductions REAL DEFAULT 0,
    netPay REAL NOT NULL, hoursWorked REAL DEFAULT 0, overtimeHours REAL DEFAULT 0,
    notes TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS payroll_payslips (
    id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
    hotelId TEXT NOT NULL, period TEXT, issueDate TEXT,
    fileUrl TEXT, sent INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS payroll_payment_history (
    id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
    hotelId TEXT NOT NULL, amount REAL NOT NULL, method TEXT DEFAULT 'bank_transfer',
    reference TEXT, paidAt TEXT, createdAt TEXT, updatedAt TEXT)`)

  // ─── Attendance ────────────────────────────────────────────────────────
  await exec(`CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    date TEXT NOT NULL, clockIn TEXT, clockOut TEXT,
    breakStart TEXT, breakEnd TEXT, status TEXT DEFAULT 'present',
    method TEXT DEFAULT 'pin', notes TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS attendance_schedules (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL, startTime TEXT NOT NULL, endTime TEXT NOT NULL,
    active INTEGER DEFAULT 1, createdAt TEXT, updatedAt TEXT)`)

  // ─── Payments (módulo payments: transacciones, links de pago, depósitos) ──
  await exec(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, folioId TEXT, invoiceId TEXT, guestId TEXT,
    type TEXT NOT NULL, method TEXT NOT NULL, status TEXT DEFAULT 'pending',
    amount REAL NOT NULL, currency TEXT DEFAULT 'USD', description TEXT DEFAULT '',
    reference TEXT DEFAULT '', stripePaymentId TEXT DEFAULT '', stripeSessionId TEXT DEFAULT '',
    metadata TEXT, processedAt TEXT, createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS payment_links (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT, folioId TEXT,
    amount REAL NOT NULL, currency TEXT DEFAULT 'USD', description TEXT DEFAULT '',
    status TEXT DEFAULT 'active', token TEXT NOT NULL, expiresAt TEXT,
    maxUses INTEGER DEFAULT 1, useCount INTEGER DEFAULT 0, paymentId TEXT,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, reservationId TEXT, guestId TEXT, roomId TEXT,
    amount REAL NOT NULL, currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'held',
    paymentMethod TEXT DEFAULT 'card', stripePaymentId TEXT DEFAULT '',
    holdReason TEXT DEFAULT 'reservation_guarantee', releasedAt TEXT,
    refundAmount REAL DEFAULT 0, notes TEXT DEFAULT '',
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS attendance_config (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL,
    lateThreshold INTEGER DEFAULT 15, overtimeEnabled INTEGER DEFAULT 1,
    biometricEnabled INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT)`)
}

// ─── Seed DEMO: Talento, Nómina, Pagos, Gastos, CRM (Hotel Boutique Palma) ──
// hotelId EXPLÍCITO (no HID) → garantiza el hotel demo donde viven IA/WhatsApp/Stripe.
// Las tablas referenciadas (departments, employee_profiles, payroll_runs, payroll_run_details,
// attendance_records, payments, expenses, coupons, roles) las crea el ORM del app en runtime
// (modelos en src/modules/). Este seed solo INSERTA datos; los campos referenciados existen
// en los ModelDefinition. Idempotente via COUNT(*) previo.
async function seedDemoTalentoFinanzas(): Promise<void> {
  const hotelRows = (await db.query("SELECT id FROM hotels WHERE name=?", ["Hotel Boutique Palma"])) as Array<{ id: string }>
  const DEMO_HOTEL = hotelRows[0]?.id
  if (!DEMO_HOTEL) return console.log("demo talento/finanzas: Hotel Boutique Palma no encontrado, skip")

  const cnt = async (t: string): Promise<number> => {
    try {
      const rows = (await db.query(`SELECT COUNT(*) c FROM ${t} WHERE hotelId=?`, [DEMO_HOTEL])) as CountRow[]
      return rows[0]?.c ?? 0
    } catch { return 0 }
  }

  // Departamentos + perfiles: idempotente (recuperar si ya existen del run anterior)
  let deptRows = (await db.query("SELECT id FROM departments WHERE hotelId=?", [DEMO_HOTEL])) as Array<{ id: string }>
  let depts = deptRows.map((r) => r.id)
  if (depts.length === 0) {
    depts = []
    for (const [name, desc] of [
      ["Recepción", "Front desk y atención al huésped"],
      ["Housekeeping", "Limpieza y preparación de habitaciones"],
      ["Mantenimiento", "Conservación y reparaciones"],
    ] as const) {
      const id = uuid()
      await run("INSERT INTO departments (id, hotelId, name, description, active, createdAt, updatedAt) VALUES (?,?,?,?,1,?,?)",
        [id, DEMO_HOTEL, name, desc, now(), now()])
      depts.push(id)
    }
  }

  let empRows = (await db.query("SELECT id, salary FROM employee_profiles WHERE hotelId=?", [DEMO_HOTEL])) as Array<{ id: string; salary: number }>
  let emps: Array<{ id: string; salary?: number }> = empRows
  if (emps.length === 0) {
    emps = []
    const seeds: Array<[string, string, string, number, string]> = [
      [USERS[0]?.id ?? uuid(), depts[0], "Recepcionista", 1850, "full_time"],
      [USERS[1]?.id ?? uuid(), depts[0], "Supervisor de Recepción", 2400, "full_time"],
      [USERS[2]?.id ?? uuid(), depts[1], "Camarera de piso", 950, "part_time"],
      [USERS[3]?.id ?? uuid(), depts[2], "Técnico de mantenimiento", 1500, "full_time"],
    ]
    for (const [userId, deptId, position, salary, contract] of seeds) {
      const id = uuid()
      await run("INSERT INTO employee_profiles (id, userId, hotelId, departmentId, position, hireDate, salary, contractType, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,1,?,?)",
        [id, userId, DEMO_HOTEL, deptId, position, "2025-03-01", salary, contract, now(), now()])
      emps.push({ id, salary })
    }
  }

  if ((await cnt("payroll_runs")) === 0) {
    const runId = uuid()
    await run("INSERT INTO payroll_runs (id, hotelId, period, startDate, endDate, paymentDate, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
      [runId, DEMO_HOTEL, "2026-06", "2026-06-01", "2026-06-30", "2026-06-30", "processed", now(), now()])
    for (const e of emps)
      await run("INSERT INTO payroll_run_details (id, runId, employeeId, baseSalary, daysWorked, hoursWorked, earnings, deductions, grossPay, totalDeductions, netPay, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [uuid(), runId, e.id, e.salary ?? 0, 22, 160, "[]", "[]", e.salary ?? 0, 0, Math.round((e.salary ?? 0) * 0.9), "processed"])
  }
  if ((await cnt("attendance_records")) === 0)
    for (const e of emps)
      await run("INSERT INTO attendance_records (id, hotelId, employeeId, date, clockIn, clockOut, status, method) VALUES (?,?,?,?,?,?,?,?)",
        [uuid(), DEMO_HOTEL, e.id, "2026-06-26", "08:00", "16:00", "present", "pin"])
  if ((await cnt("payments")) === 0)
    for (const [type, method, status, amount, desc] of [
      ["charge", "card", "completed", 320, "Reserva fin de semana"],
      ["charge", "transfer", "completed", 480, "Pago grupo corporativo"],
      ["deposit", "link", "pending", 150, "Anticipo reserva"],
    ] as const)
      await run("INSERT INTO payments (id, hotelId, type, method, status, amount, currency, description, processedAt) VALUES (?,?,?,?,?,?,?,?,?)",
        [uuid(), DEMO_HOTEL, type, method, status, amount, "USD", desc, status === "pending" ? null : "2026-06-26"])
  if ((await cnt("expenses")) === 0)
    for (const [cat, concept, amount, provider, paid] of [
      ["supplies", "Insumos de limpieza", 180, "CleanCo", true],
      ["utilities", "Electricidad", 540, "Edenor", true],
      ["maintenance", "Repuestos A/C", 95, "RefriShop", false],
    ] as const)
      await run("INSERT INTO expenses (id, hotelId, category, concept, amount, date, provider, paid) VALUES (?,?,?,?,?,?,?,?)",
        [uuid(), DEMO_HOTEL, cat, concept, amount, "2026-06-25", provider, paid ? 1 : 0])
  if ((await cnt("coupons")) === 0)
    for (const [code, type, value, minP, maxU, start, end] of [
      ["VERANO10", "percent", 10, 0, 100, "2026-06-01", "2026-09-30"],
      ["FIESTA50", "fixed", 50, 300, 50, "2026-06-01", "2026-12-31"],
      ["FINDE15", "percent", 15, 0, 200, "2026-06-01", "2026-08-31"],
    ] as const)
      await run("INSERT INTO coupons (id, hotelId, code, type, value, minPurchase, maxUses, startsAt, expiresAt, active) VALUES (?,?,?,?,?,?,?,?,?,1)",
        [uuid(), DEMO_HOTEL, code, type, value, minP, maxU, start, end])

  if ((await cnt("roles")) === 0)
    for (const [name, icon, color, perms] of [
      ["Recepcionista", "🔑", "bg-blue/20 text-blue", '["reservations.admin","guests.admin","checkin.admin"]'],
      ["Gerente", "👔", "bg-violet/20 text-violet", '["reservations.admin","rooms.admin","billing.admin","reports.admin"]'],
      ["Housekeeping", "🧹", "bg-green/20 text-green", '["housekeeping.admin"]'],
    ] as const)
      await run("INSERT INTO roles (id, hotelId, name, icon, color, system, permissions, users) VALUES (?,?,?,?,?,?,?,0)",
        [uuid(), DEMO_HOTEL, name, icon, color, 0, perms])

  console.log("demo talento/finanzas: seed completo (idempotente)")
}

// ─── CRM / Marketing / Mensajería DDL + ALTERs portables ──────────────────
async function createTablesBlock3(): Promise<void> {
  await exec(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT NOT NULL,
    type TEXT NOT NULL, points INTEGER NOT NULL, description TEXT,
    reservationId TEXT, createdAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, value REAL NOT NULL, minPurchase REAL DEFAULT 0,
    maxUses INTEGER DEFAULT 100, usedCount INTEGER DEFAULT 0,
    startsAt TEXT, expiresAt TEXT, active INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS guest_segments (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    criteria TEXT, createdAt TEXT, updatedAt TEXT)`)

  // ─── Marketing ─────────────────────────────────────────────────────────
  await exec(`CREATE TABLE IF NOT EXISTS auto_messages (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL,
    title TEXT NOT NULL, color TEXT DEFAULT '#3b82f6',
    emailSubject TEXT, emailBody TEXT, whatsappBody TEXT,
    channel TEXT DEFAULT 'email', triggerEvent TEXT NOT NULL DEFAULT 'checkin_day',
    triggerOffset INTEGER DEFAULT 0, variables TEXT DEFAULT '[]',
    isActive INTEGER DEFAULT 1,
    event TEXT, language TEXT DEFAULT 'es', triggerType TEXT DEFAULT 'cron',
    createdAt TEXT, updatedAt TEXT)`)

  // ALTER idempotente: auto_messages += event/language/triggerType (spec 11.1.6).
  // Reemplaza PRAGMA table_info por addColumnIfMissing (portable PG+SQLite).
  await addColumnIfMissing("auto_messages", "event", "TEXT")
  await addColumnIfMissing("auto_messages", "language", "TEXT DEFAULT 'es'")
  await addColumnIfMissing("auto_messages", "triggerType", "TEXT DEFAULT 'cron'")

  // ALTER idempotente: guests += language (spec 11.1.6 — idioma del huésped para resolver plantilla i18n).
  await addColumnIfMissing("guests", "language", "TEXT")
  // ALTER idempotente: guests += campos legales/CRM del cliente (detalle completo del huésped,
  // alineado con el formulario de reservas y con el Guest type del frontend).
  await addColumnIfMissing("guests", "sex", "TEXT")
  await addColumnIfMissing("guests", "country", "TEXT")
  await addColumnIfMissing("guests", "address", "TEXT")
  await addColumnIfMissing("guests", "city", "TEXT")
  await addColumnIfMissing("guests", "province", "TEXT")
  await addColumnIfMissing("guests", "documentType", "TEXT")
  await addColumnIfMissing("guests", "documentIssueDate", "TEXT")
  await addColumnIfMissing("guests", "communicateClient", "TEXT")
  await addColumnIfMissing("guests", "profession", "TEXT")
  await addColumnIfMissing("guests", "emergencyContact", "TEXT")

  await exec(`CREATE TABLE IF NOT EXISTS message_logs (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, reservationId TEXT,
    guestId TEXT, channel TEXT NOT NULL, content TEXT, status TEXT,
    sentAt TEXT, recipient TEXT, createdAt TEXT)`)

  // ALTER idempotente: columna recipient en message_logs (spec 11.1.1).
  await addColumnIfMissing("message_logs", "recipient", "TEXT")

  // ALTER idempotente: reservations += condiciones + otros cobros (F3 match-misterplan).
  await addColumnIfMissing("reservations", "gdprAccepted", "INTEGER DEFAULT 0")
  await addColumnIfMissing("reservations", "marketingAccepted", "INTEGER DEFAULT 0")
  await addColumnIfMissing("reservations", "termsAccepted", "INTEGER DEFAULT 0")
  await addColumnIfMissing("reservations", "otherCharges", "REAL DEFAULT 0")
  // Tarjeta de garantía (MisterPlan): datos parciales + bandera. No se guarda número completo ni CVV.
  await addColumnIfMissing("reservations", "hasGuaranteeCard", "INTEGER DEFAULT 0")
  await addColumnIfMissing("reservations", "cardHolder", "TEXT")
  await addColumnIfMissing("reservations", "cardBrand", "TEXT")
  await addColumnIfMissing("reservations", "cardLast4", "TEXT")
  await addColumnIfMissing("reservations", "cardExpMonth", "TEXT")
  await addColumnIfMissing("reservations", "cardExpYear", "TEXT")

  // CREATE: reservation_addons (F3 match-misterplan — otros servicios y descuentos por reserva).
  await exec(`CREATE TABLE IF NOT EXISTS reservation_addons (
    id TEXT PRIMARY KEY, reservationId TEXT NOT NULL, hotelId TEXT NOT NULL,
    description TEXT, kind TEXT DEFAULT 'service', amount REAL DEFAULT 0, quantity INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)

  await exec(`CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    language TEXT DEFAULT 'es', templateId TEXT, body TEXT NOT NULL,
    createdAt TEXT, updatedAt TEXT)`)

  // ─── M17 Gerente IA: historial de interacciones del gerente ──────────────
  await exec(`CREATE TABLE IF NOT EXISTS ai_manager_interactions (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT NOT NULL,
    query TEXT NOT NULL, response TEXT NOT NULL, queryType TEXT,
    dataSourcesUsed TEXT, confidence REAL, feedback TEXT, responseTimeMs INTEGER,
    createdAt TEXT, updatedAt TEXT)`)
}

// Seed idempotente: currency_config por defecto para todos los hoteles (F3 — conversión de moneda).
// Secondary DOP @ 60. UNIQUE(hotelId,key) + ON CONFLICT DO NOTHING → no duplica.
// Reemplaza al INSERT OR IGNORE ... SELECT randomblob()/datetime('now') (SQLite-only).
async function seedCurrencyConfig(): Promise<void> {
  try {
    const hotels = (await db.query("SELECT id FROM hotels")) as Array<{ id: string }>
    const value = JSON.stringify({ secondaryCurrency: "DOP", exchangeRate: 60 })
    for (const h of hotels) {
      await db.run(
        "INSERT INTO configuration (id, hotelId, key, value, updatedAt) VALUES (?,?,?,?,?) ON CONFLICT(hotelId, key) DO NOTHING",
        [uuid(), h.id, "currency_config", value, now()],
      )
    }
  } catch { /* hotels/configuration puede no existir en runs tempranos — seguro */ }
}

// ─── Seed BASE: datos demo mínimos para DB limpia ────────────────────────
// Crea hotels/users/rooms/guests/reservations demo si no existen (idempotente).
// IDs estables para que las relaciones (users→hotel, reservations→guest/room) resuelvan.
// Universal (DbAdapter): SQLite y Postgres. Passwords bcrypt = "demo123".
async function seedBase(): Promise<void> {
  const exists = async (table: string, id: string): Promise<boolean> =>
    ((await db.query(`SELECT id FROM ${table} WHERE id=?`, [id])) as Array<{ id: string }>).length > 0
  const HOTEL_ID = 'bca45933-075b-4f0b-bed2-322c3cd7a216'
  const HOTEL2_ID = 'aa000000-0000-0000-0000-000000000001'
  const SUPER_HASH = '$2b$10$rOu5yxjyHLI5qBct230qRu7Gy4RHXzj4kvV.Ul3yFIRij.gqJFl6W'
  const ADMIN_HASH = '$2b$10$Sgd47BfJ3pigUOpcf4LKBejWA9GxXdW7h8ePCwtLgcpUuYGG/Ogru'
  const RECEP_HASH = '$2b$10$83sBnIJsM3O8FmQtv31QjOEgC3vv6tn7bbINBV25Ya0XjOILWb4PS'
  const HOTELS_SQL = "INSERT INTO hotels (id, name, address, phone, email, country, currency, timezone, checkIn, checkOut, plan, status, roomsCount, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

  if (!(await exists('hotels', HOTEL_ID)))
    await run(HOTELS_SQL, [HOTEL_ID, 'Hotel Boutique Palma', 'Calle Principal 123, Punta Cana', '+1 809 555 0100', 'admin@caribeparadise.com', 'DO', 'USD', 'America/Santo_Domingo', '15:00', '12:00', 'professional', 'activo', 12, 1, now(), now()])
  if (!(await exists('hotels', HOTEL2_ID)))
    await run(HOTELS_SQL, [HOTEL2_ID, 'SolmiOS Corp', 'Oficinas Centrales', '+1 809 555 0000', 'admin@solmios.com', 'DO', 'USD', 'America/Santo_Domingo', '14:00', '11:00', 'enterprise', 'activo', 0, 1, now(), now()])

  const users: Array<[string, string, string, string, string, string]> = [
    ['user-super-0000-0000-000000000001', 'Super Admin', 'admin@solmios.com', SUPER_HASH, 'super_admin', HOTEL2_ID],
    ['user-admin-0000-0000-000000000002', 'Admin Palma', 'admin@caribeparadise.com', ADMIN_HASH, 'hotel_admin', HOTEL_ID],
    ['user-recep-0000-0000-000000000003', 'Maria Lopez', 'maria@caribeparadise.com', RECEP_HASH, 'receptionist', HOTEL_ID],
  ]
  for (const [id, name, email, password, role, hotelId] of users)
    if (!(await exists('users', id)))
      await run("INSERT INTO users (id, name, email, password, role, hotelId, active, isDemo, createdAt, updatedAt) VALUES (?,?,?,?,?,?,1,1,?,?)",
        [id, name, email, password, role, hotelId, now(), now()])

  const rooms: Array<[string, string, string, string, number, string, number]> = [
    ['room-0001-0000-0000-000000000001', '101', 'Suite Junior', 'suite', 120, 'disponible', 2],
    ['room-0002-0000-0000-000000000002', '102', 'Doble Estandar', 'doble', 85, 'disponible', 2],
    ['room-0003-0000-0000-000000000003', '103', 'Simple', 'simple', 65, 'disponible', 1],
    ['room-0004-0000-0000-000000000004', '201', 'Suite Ejecutiva', 'suite', 180, 'disponible', 2],
    ['room-0005-0000-0000-000000000005', '202', 'Doble Deluxe', 'doble', 110, 'disponible', 2],
    ['room-0006-0000-0000-000000000006', '203', 'Triple', 'triple', 130, 'disponible', 3],
    ['room-0007-0000-0000-000000000007', '204', 'Suite Premium', 'suite', 220, 'disponible', 2],
    ['room-0008-0000-0000-000000000008', '205', 'Doble Vista Mar', 'doble', 135, 'disponible', 2],
  ]
  for (const [id, number, name, type, basePrice, status, capacity] of rooms)
    if (!(await exists('rooms', id)))
      await run("INSERT INTO rooms (id, number, name, type, basePrice, status, hotelId, capacity, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [id, number, name, type, basePrice, status, HOTEL_ID, capacity, now(), now()])

  const guests: Array<[string, string, string, string, string, string, number, number, string]> = [
    ['guest-0001-0000-0000-000000000001', 'Carlos Mendoza', 'carlos@example.com', '+1 809 555 1001', 'P12345678', 'DO', 1, 320, 'bronze'],
    ['guest-0002-0000-0000-000000000002', 'Maria Gonzalez', 'maria.g@example.com', '+1 809 555 1002', 'P23456789', 'DO', 3, 1250, 'silver'],
    ['guest-0003-0000-0000-000000000003', 'John Smith', 'john@example.com', '+1 212 555 1003', 'US123456', 'US', 5, 3800, 'gold'],
    ['guest-0004-0000-0000-000000000004', 'Laura Martinez', 'laura@example.com', '+34 612 345 678', 'ES789012', 'ES', 2, 890, 'silver'],
    ['guest-0005-0000-0000-000000000005', 'Roberto Silva', 'roberto@example.com', '+55 11 99999001', 'BR456789', 'BR', 0, 0, 'bronze'],
  ]
  for (const [id, name, email, phone, document, nationality, totalStays, totalSpent, tier] of guests)
    if (!(await exists('guests', id)))
      await run("INSERT INTO guests (id, name, email, phone, document, nationality, totalStays, totalSpent, tier, hotelId, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)",
        [id, name, email, phone, document, nationality, totalStays, totalSpent, tier, HOTEL_ID, now(), now()])

  const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const reservations: Array<[string, string, string, string, string, string, string, number, number, number]> = [
    ['res-0001-0000-0000-000000000001', 'guest-0001-0000-0000-000000000001', 'room-0001-0000-0000-000000000001', d(-1), d(3), 'confirmada', 'booking', 480, 100, 2],
    ['res-0002-0000-0000-000000000002', 'guest-0002-0000-0000-000000000002', 'room-0002-0000-0000-000000000002', d(1), d(4), 'confirmada', 'directa', 255, 0, 2],
    ['res-0003-0000-0000-000000000003', 'guest-0003-0000-0000-000000000003', 'room-0004-0000-0000-000000000004', d(5), d(10), 'pendiente', 'airbnb', 900, 200, 2],
    ['res-0004-0000-0000-000000000004', 'guest-0004-0000-0000-000000000004', 'room-0005-0000-0000-000000000005', d(-7), d(-3), 'checkout', 'directa', 440, 100, 2],
    ['res-0005-0000-0000-000000000005', 'guest-0005-0000-0000-000000000005', 'room-0003-0000-0000-000000000003', d(10), d(12), 'pendiente', 'directa', 130, 0, 1],
  ]
  for (const [id, guestId, roomId, checkIn, checkOut, status, channel, totalAmount, deposit, adults] of reservations)
    if (!(await exists('reservations', id)))
      await run("INSERT INTO reservations (id, guestId, roomId, hotelId, checkIn, checkOut, status, channel, totalAmount, deposit, adults, currency, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,'USD',?,?)",
        [id, guestId, roomId, HOTEL_ID, checkIn, checkOut, status, channel, totalAmount, deposit, adults, now(), now()])

  console.log("seed base: hotels/users/rooms/guests/reservations demo listos")
}

// ─── Orquestador principal ────────────────────────────────────────────────
async function main(): Promise<void> {
  await db.connect()
  await seedBase()

  // Lookups (async ahora)
  const hotelRows = (await db.query("SELECT id FROM hotels LIMIT 1")) as Array<{ id: string }>
  HID = hotelRows[0]?.id
  USERS = (await db.query("SELECT id, name, email, role FROM users")) as UserRow[]
  ROOMS = (await db.query("SELECT id, number, type FROM rooms")) as RoomRow[]
  GUESTS = (await db.query("SELECT id, name FROM guests")) as GuestRow[]
  console.log(`Hotel: ${HID} | Users: ${USERS.length} | Rooms: ${ROOMS.length} | Guests: ${GUESTS.length}`)

  // DDL block 1 + seeds principales
  await createTablesBlock1()
  await seedPaquetes()
  await seedDispositivos()
  await seedAnuncios()
  await seedApiKeys()
  await seedAudit()
  await seedGrupos()
  await seedMantenimiento()
  await seedTickets()
  await seedNotif()
  await seedConfig()

  // DDL block 2 (RRHH/Payroll/Attendance/Payments)
  await createTablesBlock2()

  // DDL block 3 (CRM/Marketing/Mensajería) + ALTERs portables
  await createTablesBlock3()

  // currency_config para todos los hoteles (idempotente)
  await seedCurrencyConfig()

  // Demo talento/finanzas (idempotente; envuelto en try/catch por tablas/columnas
  // que se crean en el ORM del app y pueden no existir en un run standalone).
  try {
    await seedDemoTalentoFinanzas()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log("demo talento/finanzas: parcial —", msg.slice(0, 90))
  }

  console.log("\n✅ Migración completa")
}

main()
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("Migración falló:", msg)
    process.exitCode = 1
  })
  .finally(async () => {
    try { await db.close() } catch { /* ignore close errors on shutdown */ }
  })
