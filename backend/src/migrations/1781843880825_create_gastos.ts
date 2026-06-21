// migrations/1781843880825_create_gastos.ts
// Migración — tabla expenses (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "expenses" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "category" TEXT DEFAULT 'general',
  "concept" TEXT NOT NULL, "amount" REAL NOT NULL, "date" TEXT, "provider" TEXT,
  "invoiceNumber" TEXT, "notes" TEXT, "paid" INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS expenses`)
}
