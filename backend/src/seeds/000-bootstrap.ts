// seeds/000-bootstrap.ts — Datos demo base (corre primero por orden alfabético).
// Idempotente: INSERT OR IGNORE en todas las entidades.
import { Database } from 'bun:sqlite'
import { join } from 'path'
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seed000Bootstrap(_orm: SeedOrm): Promise<void> {
  const db = new Database(join(import.meta.dir, '../../data/managerhotel.db'))
  db.exec('PRAGMA foreign_keys=OFF')

  const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...p)
  const get = (sql: string, ...p: any[]): any => db.prepare(sql).get(...p)
  const now = new Date().toISOString()

  // ─── Hotels ──────────────────────────────────────────────────────────
  const HOTEL_ID = 'bca45933-075b-4f0b-bed2-322c3cd7a216'
  const HOTEL2_ID = 'aa000000-0000-0000-0000-000000000001'

  if (!get('SELECT id FROM hotels WHERE id=?', HOTEL_ID)) {
    run(`INSERT OR IGNORE INTO hotels
      (id, name, address, phone, email, country, currency, timezone, checkIn, checkOut, plan, status, roomsCount, active, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      HOTEL_ID, 'Hotel Boutique Palma', 'Calle Principal 123, Punta Cana', '+1 809 555 0100',
      'admin@caribeparadise.com', 'DO', 'USD', 'America/Santo_Domingo',
      '15:00', '12:00', 'professional', 'activo', 12, 1, now, now)
    console.log('  ✓ Hotel Boutique Palma creado')
  } else {
    console.log('  ⏭  Hotel Boutique Palma ya existe')
  }

  if (!get('SELECT id FROM hotels WHERE id=?', HOTEL2_ID)) {
    run(`INSERT OR IGNORE INTO hotels
      (id, name, address, phone, email, country, currency, timezone, checkIn, checkOut, plan, status, roomsCount, active, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      HOTEL2_ID, 'ManagerHotel Corp', 'Oficinas Centrales', '+1 809 555 0000',
      'admin@managerhotel.com', 'DO', 'USD', 'America/Santo_Domingo',
      '14:00', '11:00', 'enterprise', 'activo', 0, 1, now, now)
    console.log('  ✓ ManagerHotel Corp creado')
  }

  // ─── Users (password = demo123 hash bcrypt) ───────────────────────────
  const SUPER_HASH = '$2b$10$rOu5yxjyHLI5qBct230qRu7Gy4RHXzj4kvV.Ul3yFIRij.gqJFl6W'
  const ADMIN_HASH = '$2b$10$Sgd47BfJ3pigUOpcf4LKBejWA9GxXdW7h8ePCwtLgcpUuYGG/Ogru'
  const RECEP_HASH = '$2b$10$83sBnIJsM3O8FmQtv31QjOEgC3vv6tn7bbINBV25Ya0XjOILWb4PS'

  const users = [
    ['user-super-0000-0000-000000000001', 'Super Admin',   'admin@managerhotel.com',   SUPER_HASH, 'super_admin', HOTEL2_ID],
    ['user-admin-0000-0000-000000000002', 'Admin Palma',   'admin@caribeparadise.com', ADMIN_HASH, 'hotel_admin', HOTEL_ID],
    ['user-recep-0000-0000-000000000003', 'Maria Lopez',   'maria@caribeparadise.com', RECEP_HASH, 'receptionist', HOTEL_ID],
  ]
  for (const [id, name, email, password, role, hotelId] of users) {
    run(`INSERT OR IGNORE INTO users (id, name, email, password, role, hotelId, active, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,1,?,?)`, id, name, email, password, role, hotelId, now, now)
  }
  console.log('  ✓ 3 usuarios demo (password: demo123)')

  // ─── Rooms ───────────────────────────────────────────────────────────
  const rooms = [
    ['room-0001-0000-0000-000000000001', '101', 'Suite Junior',      'suite',  120, 'disponible', 2],
    ['room-0002-0000-0000-000000000002', '102', 'Doble Estandar',    'doble',   85, 'disponible', 2],
    ['room-0003-0000-0000-000000000003', '103', 'Simple',            'simple',  65, 'disponible', 1],
    ['room-0004-0000-0000-000000000004', '201', 'Suite Ejecutiva',   'suite',  180, 'disponible', 2],
    ['room-0005-0000-0000-000000000005', '202', 'Doble Deluxe',      'doble',  110, 'disponible', 2],
    ['room-0006-0000-0000-000000000006', '203', 'Triple',            'triple', 130, 'disponible', 3],
    ['room-0007-0000-0000-000000000007', '204', 'Suite Premium',     'suite',  220, 'disponible', 2],
    ['room-0008-0000-0000-000000000008', '205', 'Doble Vista Mar',   'doble',  135, 'disponible', 2],
  ]
  for (const [id, number, name, type, basePrice, status, capacity] of rooms) {
    run(`INSERT OR IGNORE INTO rooms (id, number, name, type, basePrice, status, hotelId, capacity, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, id, number, name, type, basePrice, status, HOTEL_ID, capacity, now, now)
  }
  console.log('  ✓ 8 habitaciones demo')

  // ─── Guests ──────────────────────────────────────────────────────────
  const guests = [
    ['guest-0001-0000-0000-000000000001', 'Carlos Mendoza', 'carlos@example.com', '+1 809 555 1001', 'P12345678', 'DO', 1, 320,  'bronze'],
    ['guest-0002-0000-0000-000000000002', 'Maria Gonzalez', 'maria.g@example.com','+1 809 555 1002', 'P23456789', 'DO', 3, 1250, 'silver'],
    ['guest-0003-0000-0000-000000000003', 'John Smith',     'john@example.com',   '+1 212 555 1003', 'US123456',  'US', 5, 3800, 'gold'],
    ['guest-0004-0000-0000-000000000004', 'Laura Martinez', 'laura@example.com',  '+34 612 345 678', 'ES789012',  'ES', 2, 890,  'silver'],
    ['guest-0005-0000-0000-000000000005', 'Roberto Silva',  'roberto@example.com','+55 11 99999001', 'BR456789',  'BR', 0, 0,    'bronze'],
  ]
  for (const [id, name, email, phone, document, nationality, totalStays, totalSpent, tier] of guests) {
    run(`INSERT OR IGNORE INTO guests (id, name, email, phone, document, nationality, totalStays, totalSpent, tier, hotelId, active, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`, id, name, email, phone, document, nationality, totalStays, totalSpent, tier, HOTEL_ID, now, now)
  }
  console.log('  ✓ 5 huespedes demo')

  // ─── Reservations ────────────────────────────────────────────────────
  const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const reservations = [
    ['res-0001-0000-0000-000000000001', 'guest-0001-0000-0000-000000000001', 'room-0001-0000-0000-000000000001', d(-1), d(3),   'confirmada', 'booking', 480,  100, 2],
    ['res-0002-0000-0000-000000000002', 'guest-0002-0000-0000-000000000002', 'room-0002-0000-0000-000000000002', d(1),  d(4),   'confirmada', 'directa', 255,  0,   2],
    ['res-0003-0000-0000-000000000003', 'guest-0003-0000-0000-000000000003', 'room-0004-0000-0000-000000000004', d(5),  d(10),  'pendiente',  'airbnb',  900,  200, 2],
    ['res-0004-0000-0000-000000000004', 'guest-0004-0000-0000-000000000004', 'room-0005-0000-0000-000000000005', d(-7), d(-3),  'checkout',   'directa', 440,  100, 2],
    ['res-0005-0000-0000-000000000005', 'guest-0005-0000-0000-000000000005', 'room-0003-0000-0000-000000000003', d(10), d(12),  'pendiente',  'directa', 130,  0,   1],
  ]
  for (const [id, guestId, roomId, checkIn, checkOut, status, channel, totalAmount, deposit, adults] of reservations) {
    run(`INSERT OR IGNORE INTO reservations (id, guestId, roomId, hotelId, checkIn, checkOut, status, channel, totalAmount, deposit, adults, currency, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'USD',?,?)`,
      id, guestId, roomId, HOTEL_ID, checkIn, checkOut, status, channel, totalAmount, deposit, adults, now, now)
  }
  console.log('  ✓ 5 reservas demo')

  db.exec('PRAGMA foreign_keys=ON')
  db.close()
}
