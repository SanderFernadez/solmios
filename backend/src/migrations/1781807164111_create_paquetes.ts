// migrations/1781807164111_create_paquetes.ts
// Migración — tabla packages (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "packages" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "type" TEXT DEFAULT 'upsell', "price" REAL NOT NULL, "contents" TEXT DEFAULT '[]',
  "active" INTEGER DEFAULT 1, "createdAt" TEXT DEFAULT (datetime('now')))`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS packages`)
}
