// migrations/1781807071709_create_reservas.ts
// Migración — tabla reservations (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "reservations" (
  id TEXT PRIMARY KEY, "guestId" TEXT, "roomId" TEXT NOT NULL, hotelId TEXT NOT NULL,
  checkIn TEXT NOT NULL, checkOut TEXT NOT NULL, "status" TEXT DEFAULT 'pendiente',
  "channel" TEXT DEFAULT 'directa', "totalAmount" REAL NOT NULL, "deposit" REAL DEFAULT 0,
  "currency" TEXT DEFAULT 'USD', "adults" INTEGER DEFAULT 2, "children" INTEGER DEFAULT 0,
  "notes" TEXT, "source" TEXT, "promoCode" TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS reservations`)
}
