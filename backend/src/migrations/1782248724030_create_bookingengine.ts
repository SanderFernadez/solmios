// migrations/1782248724030_create_bookingengine.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS booking_config (
      id TEXT PRIMARY KEY,
      hotelId TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'navy',
      position TEXT DEFAULT 'corner',
      currency TEXT DEFAULT 'USD',
      language TEXT DEFAULT 'es',
      minNights INTEGER DEFAULT 1,
      maxNights INTEGER DEFAULT 30,
      cancellationPolicy TEXT DEFAULT 'flexible',
      showComparison INTEGER DEFAULT 1,
      googleAdsEnabled INTEGER DEFAULT 0,
      whatsappConfirmation INTEGER DEFAULT 0,
      instantConfirmation INTEGER DEFAULT 1,
      stripeAccountId TEXT DEFAULT '',
      allowedCountries TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `)
  await db.run(`
    CREATE TABLE IF NOT EXISTS availability_cache (
      id TEXT PRIMARY KEY,
      hotelId TEXT NOT NULL,
      roomType TEXT NOT NULL,
      date TEXT NOT NULL,
      totalRooms INTEGER DEFAULT 0,
      occupied INTEGER DEFAULT 0,
      blocked INTEGER DEFAULT 0,
      available INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `)
  await db.run(`
    CREATE TABLE IF NOT EXISTS conversion_events (
      id TEXT PRIMARY KEY,
      hotelId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      event TEXT NOT NULL,
      roomType TEXT,
      amount REAL,
      source TEXT,
      utmSource TEXT,
      utmMedium TEXT,
      utmCampaign TEXT,
      device TEXT,
      country TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS booking_config`)
  await db.run(`DROP TABLE IF EXISTS availability_cache`)
  await db.run(`DROP TABLE IF EXISTS conversion_events`)
}
