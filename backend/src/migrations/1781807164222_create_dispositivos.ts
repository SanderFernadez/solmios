// migrations/1781807164222_create_dispositivos.ts
// Migración — tabla devices (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "devices" (
  id TEXT PRIMARY KEY, hotelId TEXT, "userId" TEXT, "userName" TEXT,
  "device" TEXT, "icon" TEXT DEFAULT '🖥️', "browser" TEXT, "os" TEXT,
  ip TEXT, "isMobile" INTEGER DEFAULT 0, "lastActivity" TEXT,
  createdAt TEXT DEFAULT (datetime('now')))`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS devices`)
}
