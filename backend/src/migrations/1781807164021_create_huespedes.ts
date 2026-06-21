// migrations/1781807164021_create_huespedes.ts
// Migración — tabla guests (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "guests" (
  id TEXT PRIMARY KEY, "name" TEXT NOT NULL, email TEXT, "phone" TEXT,
  "document" TEXT, "nationality" TEXT, "birthDate" TEXT,
  "preferences" TEXT, "totalStays" INTEGER DEFAULT 0, "totalSpent" REAL DEFAULT 0,
  tier TEXT DEFAULT 'bronze', hotelId TEXT NOT NULL, "notes" TEXT, "active" INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS guests`)
}
