// migrations/1781807164335_create_notificaciones.ts
// Migración — tabla notifications (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "notifications" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "userId" TEXT, "type" TEXT DEFAULT 'sistema',
  "title" TEXT NOT NULL, "message" TEXT, "read" INTEGER DEFAULT 0, "sent" INTEGER DEFAULT 0,
  "date" TEXT, "channel" TEXT, metadata TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS notifications`)
}
