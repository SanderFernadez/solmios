// 1783100000000_add_housekeeping_indexes.ts — Índices para acelerar stats y la
// validación de staffId (B2). Antes solo hotelId estaba indexado → stats filtraba
// status:'completed' con scan en memoria.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  // SQLite SÍ soporta IF NOT EXISTS en CREATE INDEX (a diferencia de ADD COLUMN);
  // el try/catch se mantiene por consistencia con el resto de migraciones del proyecto.
  for (const sql of [
    `CREATE INDEX IF NOT EXISTS idx_housekeeping_status ON housekeeping(status)`,
    `CREATE INDEX IF NOT EXISTS idx_housekeeping_endTime ON housekeeping(endTime)`,
    `CREATE INDEX IF NOT EXISTS idx_housekeeping_staffId ON housekeeping(staffId)`,
  ]) {
    try {
      await db.run(sql)
    } catch {
      /* índice ya existe — idempotente */
    }
  }
}

export async function down(_db: MigrationRunner): Promise<void> {}
