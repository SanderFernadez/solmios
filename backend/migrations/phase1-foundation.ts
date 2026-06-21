// Migración Fase 1 — Foundation Database
// Agrega columnas y tablas nuevas según spec de MisterPlan
// Comentarios en español, código y DB en inglés

import { Database } from 'bun:sqlite';

const db = new Database('./data/managerhotel.db');

// Helper para verificar si una columna existe antes de agregarla
function addColumnIfMissing(table: string, column: string, type: string, def: string = '') {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${def}`);
    console.log(`  ✅ ${table}.${column} (${type})`);
  } else {
    console.log(`  ⏭️  ${table}.${column} ya existe`);
  }
}

// Helper para crear tabla si no existe
function createTableIfMissing(name: string, sql: string) {
  const exists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if (!exists) {
    db.exec(sql);
    console.log(`  ✅ Tabla ${name} creada`);
  } else {
    console.log(`  ⏭️  Tabla ${name} ya existe`);
  }
}

// ═══════════════════════════════════════════════════════
// 1.1.1 — Columnas nuevas en hotels (Datos Básicos + Configuración)
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.1 — Columnas nuevas en hotels...');

// Tab 1: Propietario
addColumnIfMissing('hotels', 'ownerName', 'TEXT', "''");
addColumnIfMissing('hotels', 'ownerTaxId', 'TEXT', "''");
addColumnIfMissing('hotels', 'deviceEmail', 'TEXT', "''");

// Tab 2: Alojamiento
addColumnIfMissing('hotels', 'accommodationType', 'TEXT', "'hotel'");
addColumnIfMissing('hotels', 'registrationNumber', 'TEXT', "''");
addColumnIfMissing('hotels', 'website', 'TEXT', "''");
addColumnIfMissing('hotels', 'bookingEngineUrl', 'TEXT', "''");
addColumnIfMissing('hotels', 'phone2', 'TEXT', "''");
addColumnIfMissing('hotels', 'warningPhone', 'TEXT', "''");
addColumnIfMissing('hotels', 'secondaryCurrency', 'TEXT', "''");
addColumnIfMissing('hotels', 'youtubeUrl', 'TEXT', "''");
addColumnIfMissing('hotels', 'starRating', 'TEXT', "''");
addColumnIfMissing('hotels', 'onlineBookingStatus', 'TEXT', "'active'");
addColumnIfMissing('hotels', 'motorVersion', 'TEXT', "'v1'");

// Tab 4: Localización
addColumnIfMissing('hotels', 'latitude', 'REAL', '0');
addColumnIfMissing('hotels', 'longitude', 'REAL', '0');
addColumnIfMissing('hotels', 'province', 'TEXT', "''");
addColumnIfMissing('hotels', 'municipality', 'TEXT', "''");
addColumnIfMissing('hotels', 'locality', 'TEXT', "''");
addColumnIfMissing('hotels', 'postalCode', 'TEXT', "''");

// Condiciones adicionales
addColumnIfMissing('hotels', 'cleaningType', 'TEXT', "'checkout'");
addColumnIfMissing('hotels', 'depositType', 'TEXT', "'none'");
addColumnIfMissing('hotels', 'depositFixed', 'REAL', '0');
addColumnIfMissing('hotels', 'advanceType', 'TEXT', "'percentage'");
addColumnIfMissing('hotels', 'advanceAmount', 'REAL', '0');
addColumnIfMissing('hotels', 'releaseHours', 'INTEGER', '0');
addColumnIfMissing('hotels', 'defaultPaymentMethod', 'TEXT', "'transfer'");
addColumnIfMissing('hotels', 'requestReviews', 'INTEGER', '0');
addColumnIfMissing('hotels', 'publishReviewScore', 'INTEGER', '0');
addColumnIfMissing('hotels', 'publishReviewComments', 'INTEGER', '0');
addColumnIfMissing('hotels', 'taxName', 'TEXT', "'ITBIS'");
addColumnIfMissing('hotels', 'taxRate', 'REAL', '18.0');

// Descripción multilingüe (JSON)
addColumnIfMissing('hotels', 'descriptionJson', 'TEXT', "''");

// WiFi (para auto-mensajes)
addColumnIfMissing('hotels', 'wifiNetwork', 'TEXT', "''");
addColumnIfMissing('hotels', 'wifiPassword', 'TEXT', "''");

// ═══════════════════════════════════════════════════════
// 1.1.2 — Columnas nuevas en reservations (OTA + Pagos)
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.2 — Columnas nuevas en reservations...');

addColumnIfMissing('reservations', 'externalLocator', 'TEXT', "''");
addColumnIfMissing('reservations', 'commission', 'REAL', '0');
addColumnIfMissing('reservations', 'commissionAmount', 'REAL', '0');
addColumnIfMissing('reservations', 'paymentMethod', 'TEXT', "''");
addColumnIfMissing('reservations', 'pendingAmount', 'REAL', '0');
addColumnIfMissing('reservations', 'autoSendEnabled', 'INTEGER', '1');
addColumnIfMissing('reservations', 'preCheckinStatus', 'TEXT', "'pending'");
addColumnIfMissing('reservations', 'preCheckinHash', 'TEXT', "''");
addColumnIfMissing('reservations', 'groupId', 'TEXT', "''");
addColumnIfMissing('reservations', 'otaNotes', 'TEXT', "''");

// Columnas nuevas en rooms (superficie, baños, etc.)
console.log('\n📦 1.1.2b — Columnas nuevas en rooms...');
addColumnIfMissing('rooms', 'surfaceArea', 'REAL', '0');
addColumnIfMissing('rooms', 'bathrooms', 'INTEGER', '1');
addColumnIfMissing('rooms', 'motorPosition', 'INTEGER', '0');
addColumnIfMissing('rooms', 'onlineBookingEnabled', 'INTEGER', '1');
addColumnIfMissing('rooms', 'excludeFromReports', 'INTEGER', '0');
addColumnIfMissing('rooms', 'descriptionJson', 'TEXT', "''");

// ═══════════════════════════════════════════════════════
// 1.1.3-4 — Tablas de Amenities
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.3-4 — Tablas de amenities...');

createTableIfMissing('hotel_amenities', `
  CREATE TABLE hotel_amenities (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    amenityKey TEXT NOT NULL,
    amenityCategory TEXT NOT NULL DEFAULT 'interior',
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT '',
    UNIQUE(hotelId, amenityKey)
  )
`);

createTableIfMissing('room_amenities', `
  CREATE TABLE room_amenities (
    id TEXT PRIMARY KEY,
    roomId TEXT NOT NULL,
    amenityKey TEXT NOT NULL,
    isShared INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT '',
    UNIQUE(roomId, amenityKey, isShared)
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.5-6 — Tablas de Temporadas y Tarifas
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.5-6 — Tablas de temporadas y tarifas...');

createTableIfMissing('seasons', `
  CREATE TABLE seasons (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT DEFAULT '',
    startDate TEXT DEFAULT '',
    endDate TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    sortOrder INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT '',
    UNIQUE(hotelId, name)
  )
`);

createTableIfMissing('room_rates', `
  CREATE TABLE room_rates (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    roomType TEXT NOT NULL,
    occupancy INTEGER NOT NULL,
    season TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT '',
    UNIQUE(hotelId, roomType, occupancy, season)
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.7-8 — Tablas de Cerraduras (TTLock)
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.7-8 — Tablas de cerraduras TTLock...');

createTableIfMissing('lock_devices', `
  CREATE TABLE lock_devices (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    roomId TEXT DEFAULT '',
    ttlockLockId TEXT DEFAULT '',
    name TEXT DEFAULT '',
    mac TEXT DEFAULT '',
    batteryLevel INTEGER DEFAULT 0,
    status TEXT DEFAULT 'offline',
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

createTableIfMissing('lock_codes', `
  CREATE TABLE lock_codes (
    id TEXT PRIMARY KEY,
    lockId TEXT NOT NULL,
    reservationId TEXT DEFAULT '',
    code TEXT DEFAULT '',
    codeType TEXT DEFAULT 'time',
    startDate TEXT DEFAULT '',
    endDate TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    ttlockKeyboardPwdId TEXT DEFAULT '',
    sentVia TEXT DEFAULT '',
    sentAt TEXT DEFAULT '',
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.9-10 — Auto-mensajes y Acompañantes
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.9-10 — Auto-mensajes y acompañantes...');

createTableIfMissing('auto_messages', `
  CREATE TABLE auto_messages (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    title TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    emailSubject TEXT DEFAULT '',
    emailBody TEXT DEFAULT '',
    whatsappBody TEXT DEFAULT '',
    channel TEXT DEFAULT 'email',
    triggerEvent TEXT NOT NULL DEFAULT 'checkin_day',
    triggerOffset INTEGER DEFAULT 0,
    variables TEXT DEFAULT '[]',
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

createTableIfMissing('companions', `
  CREATE TABLE companions (
    id TEXT PRIMARY KEY,
    reservationId TEXT NOT NULL,
    name TEXT NOT NULL,
    documentType TEXT DEFAULT '',
    documentNumber TEXT DEFAULT '',
    nationality TEXT DEFAULT '',
    birthDate TEXT DEFAULT '',
    isMainGuest INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.11 — Logs de mensajes
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.11 — Tabla de logs de mensajes...');

createTableIfMissing('message_logs', `
  CREATE TABLE message_logs (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    reservationId TEXT DEFAULT '',
    messageId TEXT DEFAULT '',
    messageType TEXT DEFAULT 'email',
    status TEXT DEFAULT 'pending',
    recipient TEXT DEFAULT '',
    response TEXT DEFAULT '',
    sentAt TEXT DEFAULT '',
    createdAt TEXT DEFAULT ''
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.12 — Requerimientos de pago
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.12 — Tabla de requerimientos de pago...');

createTableIfMissing('payment_requests', `
  CREATE TABLE payment_requests (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    reservationId TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    stripeSessionId TEXT DEFAULT '',
    stripePaymentUrl TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    sentTo TEXT DEFAULT '',
    sentVia TEXT DEFAULT 'email',
    paidAt TEXT DEFAULT '',
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.13 — Plantillas de WhatsApp
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.13 — Tabla de plantillas WhatsApp...');

createTableIfMissing('whatsapp_templates', `
  CREATE TABLE whatsapp_templates (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    name TEXT NOT NULL,
    body TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

// ═══════════════════════════════════════════════════════
// 1.1.14 — Bloqueos de habitaciones (Planning)
// ═══════════════════════════════════════════════════════
console.log('\n📦 1.1.14 — Tabla de bloqueos de habitaciones...');

createTableIfMissing('room_blocks', `
  CREATE TABLE room_blocks (
    id TEXT PRIMARY KEY,
    hotelId TEXT NOT NULL,
    roomId TEXT NOT NULL,
    reason TEXT DEFAULT '',
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    createdBy TEXT DEFAULT '',
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  )
`);

// ═══════════════════════════════════════════════════════
// Verificación final
// ═══════════════════════════════════════════════════════
console.log('\n🔍 Verificación final...');
const allTables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[];
console.log(`\n✅ Total de tablas: ${allTables.length}`);
console.log(allTables.map(t => t.name).join(', '));

db.close();
console.log('\n✅ Migración completada.');
