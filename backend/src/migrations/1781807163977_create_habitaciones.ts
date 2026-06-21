// migrations/1781807163977_create_habitaciones.ts
// Migración — tabla rooms (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "rooms" (
  id TEXT PRIMARY KEY, "number" TEXT NOT NULL, "name" TEXT, "type" TEXT DEFAULT 'doble',
  "basePrice" REAL NOT NULL, "status" TEXT DEFAULT 'disponible', hotelId TEXT NOT NULL,
  "description" TEXT, "capacity" INTEGER DEFAULT 2, amenities TEXT, "floor" INTEGER,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hotelId) REFERENCES "hotels"(id)
)`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS rooms`)
}
