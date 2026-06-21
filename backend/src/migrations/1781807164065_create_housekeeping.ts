// migrations/1781807164065_create_housekeeping.ts
// Migración — tabla housekeeping (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
// Los defaults coinciden con model.ts (full_cleaning / medium / pending).
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "housekeeping" (
  id TEXT PRIMARY KEY, "roomId" TEXT NOT NULL, "hotelId" TEXT NOT NULL,
  "staffId" TEXT, "type" TEXT DEFAULT 'full_cleaning', "priority" TEXT DEFAULT 'medium',
  "status" TEXT DEFAULT 'pending', "notes" TEXT, "assignedDate" TEXT,
  "completedDate" TEXT, "cleaningItems" TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS housekeeping`)
}
