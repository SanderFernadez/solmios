import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

// F2 — Agrega campos de timings y evidencia fotográfica a housekeeping.
// duration NO se persiste (se calcula en runtime endTime - startTime).
// SQLite no soporta ADD COLUMN IF NOT EXISTS → try/catch para idempotencia.
export async function up(db: MigrationRunner): Promise<void> {
  for (const col of [
    `ALTER TABLE housekeeping ADD COLUMN "startTime" TEXT`,
    `ALTER TABLE housekeeping ADD COLUMN "endTime" TEXT`,
    `ALTER TABLE housekeeping ADD COLUMN "photos" TEXT`, // JSON array de PhotoEvidence
  ]) {
    try {
      await db.run(col)
    } catch {
      // La columna ya existe — idempotente.
    }
  }
}

export async function down(_db: MigrationRunner): Promise<void> {
  // SQLite no soporta DROP COLUMN de forma portable; no-op.
}
