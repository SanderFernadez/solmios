// migrations/1781807164267_create_apikeys.ts
// Migración — tabla api_keys (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "api_keys" (
  id TEXT PRIMARY KEY, hotelId TEXT, "name" TEXT NOT NULL, scope TEXT,
  masked TEXT, secretHash TEXT, "active" INTEGER DEFAULT 1, requests INTEGER DEFAULT 0,
  "lastUsed" TEXT, createdAt TEXT DEFAULT (datetime('now')))`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS api_keys`)
}
