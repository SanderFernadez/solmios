// migrations/1783005060295_create_caja.ts
// Migración — tablas cash_movements + cash_shifts del módulo Caja (schema en INGLÉS, DB English Only).
// Reescribe la migración genérica del scaffold (tabla `cash`) por las 2 tablas reales.
// DDL SQLite, idempotente. El ORM sync también las crea (CREATE IF NOT EXISTS) — doble aseguramiento.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "cash_movements" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, shiftId TEXT,
  "type" TEXT NOT NULL, "amount" REAL NOT NULL, "method" TEXT,
  "concept" TEXT, "category" TEXT DEFAULT 'general', "source" TEXT DEFAULT 'manual',
  "guestName" TEXT, "roomNumber" TEXT, "reservationId" TEXT, "folioId" TEXT,
  "paymentId" TEXT, "reference" TEXT, "createdBy" TEXT, "notes" TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT
)`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cash_movements_hotel ON "cash_movements"(hotelId)`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON "cash_movements"(shiftId)`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cash_movements_reservation ON "cash_movements"(reservationId)`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cash_movements_payment ON "cash_movements"(paymentId)`)

  await db.run(`CREATE TABLE IF NOT EXISTS "cash_shifts" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "status" TEXT DEFAULT 'open',
  "openingAmount" REAL DEFAULT 0, "countedAmount" REAL, "expectedAmount" REAL, "difference" REAL,
  "denominations" TEXT DEFAULT '{}', "openedBy" TEXT, "closedBy" TEXT,
  "openedAt" TEXT, "closedAt" TEXT, "notes" TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT
)`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cash_shifts_hotel ON "cash_shifts"(hotelId)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS cash_movements`)
  await db.run(`DROP TABLE IF EXISTS cash_shifts`)
}
