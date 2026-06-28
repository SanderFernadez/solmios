// migrations/1782250722091_create_payments.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, folioId TEXT, invoiceId TEXT, guestId TEXT,
    type TEXT NOT NULL, method TEXT NOT NULL, status TEXT DEFAULT 'pending',
    amount REAL NOT NULL, currency TEXT DEFAULT 'USD', description TEXT DEFAULT '',
    reference TEXT DEFAULT '', stripePaymentId TEXT DEFAULT '', stripeSessionId TEXT DEFAULT '',
    metadata TEXT, processedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS payment_links (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, guestId TEXT, folioId TEXT,
    amount REAL NOT NULL, currency TEXT DEFAULT 'USD', description TEXT DEFAULT '',
    status TEXT DEFAULT 'active', token TEXT NOT NULL, expiresAt TEXT,
    maxUses INTEGER DEFAULT 1, useCount INTEGER DEFAULT 0, paymentId TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, reservationId TEXT, guestId TEXT, roomId TEXT,
    amount REAL NOT NULL, currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'held',
    paymentMethod TEXT DEFAULT 'card', stripePaymentId TEXT DEFAULT '',
    holdReason TEXT DEFAULT 'reservation_guarantee', releasedAt TEXT,
    refundAmount REAL DEFAULT 0, notes TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS deposits`)
  await db.run(`DROP TABLE IF EXISTS payment_links`)
  await db.run(`DROP TABLE IF EXISTS payments`)
}
