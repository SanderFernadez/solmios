// migrations/1781807164200_create_roles.ts
// Migración — tabla roles (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "roles" (
  id TEXT PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT DEFAULT '👤', color TEXT,
  "system" INTEGER DEFAULT 0, hotelId TEXT, permissions TEXT DEFAULT '[]', "users" INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS roles`)
}
