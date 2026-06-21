// migrate-to-english.ts — Renames all Spanish table/column names to English
// Run: cd backend && bun run migrate-to-english.ts
import { Database } from 'bun:sqlite'

const DB = './data/managerhotel.db'
const db = new Database(DB)

db.exec('PRAGMA foreign_keys = OFF')
db.exec('BEGIN TRANSACTION')

console.log('🔧 Migrating database to English...\n')

// ─── Table renames ──────────────────────────────────────────────────────────
const tableRenames: [string, string][] = [
  ['usuarios', 'users'],
  ['hoteles', 'hotels'],
  ['habitaciones', 'rooms'],
  ['reservas', 'reservations'],
  ['huespedes', 'guests'],
  ['facturas', 'invoices'],
  ['housekeeping', 'housekeeping'], // already English
  ['mantenimiento', 'maintenance'],
  ['paquetes', 'packages'],
  ['grupos', 'groups'],
  ['dispositivos', 'devices'],
  ['anuncios', 'announcements'],
  ['api_keys', 'api_keys'], // already English
  ['audit_log', 'audit_log'], // already English
  ['tickets', 'tickets'], // already English
  ['notificaciones', 'notifications'],
  ['configuracion', 'configuration'],
  ['canales_config', 'channel_config'],
  ['roles', 'roles'], // already English
  ['gastos', 'expenses'],
  ['opiniones', 'reviews'],
]

for (const [old, nw] of tableRenames) {
  try {
    db.exec(`ALTER TABLE ${old} RENAME TO ${nw}`)
    console.log(`  ✅ ${old} → ${nw}`)
  } catch (e: any) {
    console.log(`  ⚠️  ${old} → ${nw} (${e.message.split('\n')[0]})`)
  }
}

console.log('\n📋 Column renames...\n')

// ─── Column renames ─────────────────────────────────────────────────────────
const colRenames: [string, string, string][] = [
  // users
  ['users', 'nombre', 'name'],
  ['users', 'activo', 'active'],
  ['users', 'telefono', 'phone'],
  // hotels
  ['hotels', 'nombre', 'name'],
  ['hotels', 'direccion', 'address'],
  ['hotels', 'telefono', 'phone'],
  ['hotels', 'pais', 'country'],
  ['hotels', 'moneda', 'currency'],
  ['hotels', 'zonaHoraria', 'timezone'],
  ['hotels', 'estado', 'status'],
  ['hotels', 'habitacionesCount', 'roomsCount'],
  ['hotels', 'propietarioId', 'ownerId'],
  ['hotels', 'activo', 'active'],
  // rooms
  ['rooms', 'numero', 'number'],
  ['rooms', 'nombre', 'name'],
  ['rooms', 'tipo', 'type'],
  ['rooms', 'precioBase', 'basePrice'],
  ['rooms', 'estado', 'status'],
  ['rooms', 'descripcion', 'description'],
  ['rooms', 'capacidad', 'capacity'],
  ['rooms', 'piso', 'floor'],
  // reservations
  ['reservations', 'huespedId', 'guestId'],
  ['reservations', 'habitacionId', 'roomId'],
  ['reservations', 'estado', 'status'],
  ['reservations', 'canal', 'channel'],
  ['reservations', 'montoTotal', 'totalAmount'],
  ['reservations', 'anticipo', 'deposit'],
  ['reservations', 'moneda', 'currency'],
  ['reservations', 'adultos', 'adults'],
  ['reservations', 'ninos', 'children'],
  ['reservations', 'notas', 'notes'],
  ['reservations', 'origen', 'source'],
  ['reservations', 'codigoPromocional', 'promoCode'],
  // guests
  ['guests', 'nombre', 'name'],
  ['guests', 'telefono', 'phone'],
  ['guests', 'documento', 'document'],
  ['guests', 'nacionalidad', 'nationality'],
  ['guests', 'fechaNacimiento', 'birthDate'],
  ['guests', 'preferencias', 'preferences'],
  ['guests', 'totalEstancias', 'totalStays'],
  ['guests', 'totalGastado', 'totalSpent'],
  ['guests', 'notas', 'notes'],
  ['guests', 'activo', 'active'],
  // invoices
  ['invoices', 'reservaId', 'reservationId'],
  ['invoices', 'huespedId', 'guestId'],
  ['invoices', 'numeroFactura', 'invoiceNumber'],
  ['invoices', 'tipo', 'type'],
  ['invoices', 'monto', 'amount'],
  ['invoices', 'moneda', 'currency'],
  ['invoices', 'impuestos', 'taxes'],
  ['invoices', 'metodoPago', 'paymentMethod'],
  ['invoices', 'estado', 'status'],
  ['invoices', 'fechaEmision', 'issueDate'],
  ['invoices', 'fechaVencimiento', 'dueDate'],
  ['invoices', 'notas', 'notes'],
  ['invoices', 'archivoUrl', 'fileUrl'],
  // maintenance
  ['maintenance', 'habitacionId', 'roomId'],
  ['maintenance', 'habitacionNumero', 'roomNumber'],
  ['maintenance', 'titulo', 'title'],
  ['maintenance', 'descripcion', 'description'],
  ['maintenance', 'categoria', 'category'],
  ['maintenance', 'prioridad', 'priority'],
  ['maintenance', 'estado', 'status'],
  ['maintenance', 'asignadoA', 'assignedTo'],
  ['maintenance', 'costoEstimado', 'estimatedCost'],
  ['maintenance', 'fechaReporte', 'reportedDate'],
  ['maintenance', 'fechaResolucion', 'resolvedDate'],
  // housekeeping
  ['housekeeping', 'habitacionId', 'roomId'],
  ['housekeeping', 'personalId', 'staffId'],
  ['housekeeping', 'tipo', 'type'],
  ['housekeeping', 'prioridad', 'priority'],
  ['housekeeping', 'estado', 'status'],
  ['housekeeping', 'notas', 'notes'],
  ['housekeeping', 'fechaAsignacion', 'assignedDate'],
  ['housekeeping', 'fechaCompletado', 'completedDate'],
  ['housekeeping', 'itemsLimpieza', 'cleaningItems'],
  // packages
  ['packages', 'nombre', 'name'],
  ['packages', 'descripcion', 'description'],
  ['packages', 'tipo', 'type'],
  ['packages', 'precio', 'price'],
  ['packages', 'contenido', 'contents'],
  ['packages', 'activo', 'active'],
  ['packages', 'creadoEn', 'createdAt'],
  // groups
  ['groups', 'nombre', 'name'],
  ['groups', 'liderHuespedId', 'leadGuestId'],
  ['groups', 'totalHabitaciones', 'totalRooms'],
  ['groups', 'estado', 'status'],
  ['groups', 'montoTotal', 'totalAmount'],
  ['groups', 'notas', 'notes'],
  // devices
  ['devices', 'usuarioId', 'userId'],
  ['devices', 'usuarioNombre', 'userName'],
  ['devices', 'dispositivo', 'device'],
  ['devices', 'icono', 'icon'],
  ['devices', 'navegador', 'browser'],
  ['devices', 'sistemaOperativo', 'os'],
  ['devices', 'esMovil', 'isMobile'],
  ['devices', 'ultimaActividad', 'lastActivity'],
  // announcements
  ['announcements', 'autorId', 'authorId'],
  ['announcements', 'titulo', 'title'],
  ['announcements', 'mensaje', 'message'],
  ['announcements', 'tipo', 'type'],
  ['announcements', 'prioridad', 'priority'],
  ['announcements', 'activo', 'active'],
  ['announcements', 'fecha', 'date'],
  // notifications
  ['notifications', 'usuarioId', 'userId'],
  ['notifications', 'tipo', 'type'],
  ['notifications', 'titulo', 'title'],
  ['notifications', 'mensaje', 'message'],
  ['notifications', 'leido', 'read'],
  ['notifications', 'enviado', 'sent'],
  ['notifications', 'fecha', 'date'],
  ['notifications', 'canal', 'channel'],
  // tickets
  ['tickets', 'usuarioId', 'userId'],
  ['tickets', 'asunto', 'subject'],
  ['tickets', 'categoria', 'category'],
  ['tickets', 'prioridad', 'priority'],
  ['tickets', 'estado', 'status'],
  ['tickets', 'descripcion', 'description'],
  ['tickets', 'adjuntos', 'attachments'],
  ['tickets', 'asignadoA', 'assignedTo'],
  ['tickets', 'mensajes', 'messages'],
  // audit_log
  ['audit_log', 'usuarioId', 'userId'],
  ['audit_log', 'usuarioNombre', 'userName'],
  ['audit_log', 'accion', 'action'],
  ['audit_log', 'entidad', 'entity'],
  ['audit_log', 'entidadId', 'entityId'],
  ['audit_log', 'detalle', 'detail'],
  // api_keys
  ['api_keys', 'nombre', 'name'],
  ['api_keys', 'activo', 'active'],
  ['api_keys', 'ultimoUso', 'lastUsed'],
  // configuration
  ['configuration', 'clave', 'key'],
  ['configuration', 'valor', 'value'],
  // channel_config
  ['channel_config', 'channexPropertyId', 'channexPropertyId'],
  ['channel_config', 'channexApiKey', 'channexApiKey'],
  ['channel_config', 'syncEnabled', 'syncEnabled'],
  ['channel_config', 'ultimaSync', 'lastSync'],
  // roles
  ['roles', 'nombre', 'name'],
  ['roles', 'icono', 'icon'],
  ['roles', 'sistema', 'system'],
  ['roles', 'usuarios', 'users'],
  // reviews
  ['reviews', 'huespedId', 'guestId'],
  ['reviews', 'reservaId', 'reservationId'],
  ['reviews', 'puntuacion', 'rating'],
  ['reviews', 'titulo', 'title'],
  ['reviews', 'comentario', 'comment'],
  ['reviews', 'respuesta', 'response'],
  ['reviews', 'fecha', 'date'],
  ['reviews', 'visible', 'visible'],
  ['reviews', 'canal', 'channel'],
  // expenses
  ['expenses', 'categoria', 'category'],
  ['expenses', 'concepto', 'concept'],
  ['expenses', 'importe', 'amount'],
  ['expenses', 'fecha', 'date'],
  ['expenses', 'proveedor', 'provider'],
  ['expenses', 'facturaNumero', 'invoiceNumber'],
  ['expenses', 'notas', 'notes'],
  ['expenses', 'pagado', 'paid'],
]

let success = 0
let skipped = 0
for (const [table, oldCol, newCol] of colRenames) {
  try {
    db.exec(`ALTER TABLE "${table}" RENAME COLUMN "${oldCol}" TO "${newCol}"`)
    success++
  } catch (e: any) {
    // Column might already be renamed or doesn't exist
    skipped++
  }
}
console.log(`  ✅ ${success} columns renamed, ${skipped} skipped\n`)

db.exec('COMMIT')
db.exec('PRAGMA foreign_keys = ON')

// Verify
console.log('📊 Verification:')
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[]
for (const t of tables) {
  const count = (db.query(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as any)?.c ?? 0
  console.log(`  ${t.name} (${count} rows)`)
}

db.close()
console.log('\n✅ Migration complete!')
