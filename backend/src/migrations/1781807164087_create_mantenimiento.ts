// migrations/1781807164087_create_mantenimiento.ts
// Migración — tabla maintenance (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "maintenance" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "roomId" TEXT, "roomNumber" TEXT,
  "title" TEXT NOT NULL, "description" TEXT, "category" TEXT DEFAULT 'general',
  "priority" TEXT DEFAULT 'media', "status" TEXT DEFAULT 'abierto', "assignedTo" TEXT,
  "estimatedCost" REAL DEFAULT 0, "reportedDate" TEXT, "resolvedDate" TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS maintenance`)
}
