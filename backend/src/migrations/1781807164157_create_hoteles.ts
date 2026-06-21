// migrations/1781807164157_create_hoteles.ts
// Migración — tabla hotels (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "hotels" (
  id TEXT PRIMARY KEY, "name" TEXT NOT NULL, "address" TEXT, "phone" TEXT,
  email TEXT, "country" TEXT, "currency" TEXT DEFAULT 'USD', "timezone" TEXT DEFAULT 'America/Santo_Domingo',
  checkIn TEXT DEFAULT '15:00', checkOut TEXT DEFAULT '12:00',
  plan TEXT DEFAULT 'professional', "status" TEXT DEFAULT 'activo',
  logo TEXT, "roomsCount" INTEGER DEFAULT 0, "ownerId" TEXT, "active" INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS hotels`)
}
