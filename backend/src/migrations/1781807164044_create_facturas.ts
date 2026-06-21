// migrations/1781807164044_create_facturas.ts
// Migración — tabla invoices (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "invoices" (
  id TEXT PRIMARY KEY, "reservationId" TEXT, hotelId TEXT NOT NULL, "guestId" TEXT,
  "invoiceNumber" TEXT NOT NULL, "type" TEXT DEFAULT 'factura', "amount" REAL NOT NULL,
  "currency" TEXT DEFAULT 'USD', "taxes" TEXT, "paymentMethod" TEXT,
  "status" TEXT DEFAULT 'pendiente', "issueDate" TEXT NOT NULL, "dueDate" TEXT,
  "notes" TEXT, "fileUrl" TEXT, ncf TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS invoices`)
}
