// migrations/1782255408021_create_crm.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY, guestId TEXT NOT NULL, hotelId TEXT NOT NULL,
    reservationId TEXT, type TEXT NOT NULL, points INTEGER NOT NULL,
    description TEXT, expiresAt TEXT, redeemed INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, value REAL NOT NULL, minPurchase REAL DEFAULT 0,
    maxUses INTEGER, useCount INTEGER DEFAULT 0, startsAt TEXT, expiresAt TEXT,
    segmentId TEXT, pointsCost INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS guest_segments (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    description TEXT, rules TEXT, count INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS guest_segments`)
  await db.run(`DROP TABLE IF EXISTS coupons`)
  await db.run(`DROP TABLE IF EXISTS loyalty_transactions`)
}
