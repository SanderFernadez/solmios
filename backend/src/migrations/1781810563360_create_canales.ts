// migrations/1781810563360_create_canales.ts
// Migración — tabla channel_config (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "channel_config" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "channexPropertyId" TEXT,
  "channexApiKey" TEXT, "syncEnabled" INTEGER DEFAULT 1, "lastSync" TEXT,
  config TEXT DEFAULT '{}',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS channel_config`)
}
