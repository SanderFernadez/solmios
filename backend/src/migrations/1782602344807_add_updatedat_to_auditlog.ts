// migrations/1782602344807_add_updatedat_to_auditlog.ts
// Añade la columna updatedAt a audit_log. El modelo Auditlog (módulo auditlog) tiene timestamps:true,
// pero la migración original 1781807164288_create_auditlog NO creó updatedAt (solo createdAt).
// Sin esta columna, los orm.create('Auditlog', ...) fallan con "no such column: updatedAt".
// Idempotente: SQLite no soporta ADD COLUMN IF NOT EXISTS → se atrapa el error si ya existe.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  try {
    await db.run(`ALTER TABLE audit_log ADD COLUMN updatedAt TEXT`)
  } catch {
    // La columna ya existe — idempotente.
  }
}

export async function down(_db: MigrationRunner): Promise<void> {
  // SQLite no soporta DROP COLUMN de forma portable; no-op (la columna es inofensiva).
}
