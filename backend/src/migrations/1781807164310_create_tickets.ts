// migrations/1781807164310_create_tickets.ts
// Migración — tabla tickets (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "tickets" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL, "category" TEXT DEFAULT 'tecnico', "priority" TEXT DEFAULT 'media',
  "status" TEXT DEFAULT 'abierto', "description" TEXT, "attachments" TEXT,
  "assignedTo" TEXT, slaStatus TEXT, slaBreached INTEGER DEFAULT 0, "messages" TEXT DEFAULT '[]',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS tickets`)
}
