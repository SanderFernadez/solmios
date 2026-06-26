// migrations/1782254465425_create_attendance.ts
// Migración generada por arckode make:module
// SQL ANSI — compatible con SQLite, MySQL y Postgres sin modificaciones.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      nombre VARCHAR(255) NOT NULL
      activo BOOLEAN,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS attendance`)
}
