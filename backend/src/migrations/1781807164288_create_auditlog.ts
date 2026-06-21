// migrations/1781807164288_create_auditlog.ts
// Migración — tabla audit_log (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "audit_log" (
  id TEXT PRIMARY KEY, hotelId TEXT, "userId" TEXT, "userName" TEXT,
  "action" TEXT NOT NULL, "entity" TEXT, "entityId" TEXT, "detail" TEXT, ip TEXT,
  createdAt TEXT DEFAULT (datetime('now')))`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS audit_log`)
}
