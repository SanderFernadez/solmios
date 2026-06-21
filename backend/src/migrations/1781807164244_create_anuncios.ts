// migrations/1781807164244_create_anuncios.ts
// Migración — tabla announcements (schema en INGLÉS, regla DB English Only).
// DDL generado desde el schema vivo de la DB (SQLite). Idempotente.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS "announcements" (
  id TEXT PRIMARY KEY, hotelId TEXT, "authorId" TEXT, "title" TEXT NOT NULL, "message" TEXT,
  "type" TEXT DEFAULT 'info', "priority" TEXT DEFAULT 'media', "active" INTEGER DEFAULT 1,
  "date" TEXT DEFAULT (datetime('now')), createdAt TEXT DEFAULT (datetime('now')))`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS announcements`)
}
