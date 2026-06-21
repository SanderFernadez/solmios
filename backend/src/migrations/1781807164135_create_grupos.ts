// migrations/1781807164135_create_grupos.ts
// Migración — tabla groups (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "groups" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "name" TEXT NOT NULL, "leadGuestId" TEXT,
  "totalRooms" INTEGER DEFAULT 1, checkIn TEXT, checkOut TEXT, "status" TEXT DEFAULT 'pendiente',
  "totalAmount" REAL DEFAULT 0, "notes" TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS groups`)
}
