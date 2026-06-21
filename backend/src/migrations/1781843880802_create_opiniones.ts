// migrations/1781843880802_create_opiniones.ts
// Migración — tabla reviews (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "reviews" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, "guestId" TEXT, "reservationId" TEXT,
  "rating" REAL NOT NULL, "title" TEXT, "comment" TEXT, "response" TEXT,
  "date" TEXT, "visible" INTEGER DEFAULT 1, "channel" TEXT DEFAULT 'directa',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS reviews`)
}
