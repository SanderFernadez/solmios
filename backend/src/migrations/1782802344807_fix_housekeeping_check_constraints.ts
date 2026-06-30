// migrations/1782802344807_fix_housekeeping_check_constraints.ts
//
// Elimina los CHECK constraints restrictivos de `housekeeping` que causaban HTTP 500
// al usar status='inspected' o priority='urgent' (rechazados por la tabla vieja):
//   CHECK (status IN ('pending','in_progress','completed','cancelled'))  — sin 'inspected'
//   CHECK (priority IN ('low','medium','high'))                          — sin 'urgent'
// Validator (schema.ts), model.ts y frontend SÍ usan esos valores. El DEFAULT de `type`
// estaba además en español ('limpieza_completa') — se normaliza a 'full_cleaning'.
//
// La validación de enums la hace validateSchema() en el controller (patrón arckode:
// no duplicar validación de negocio en la DB). SQLite no soporta ALTER DROP CHECK →
// se recrea la tabla (CREATE new sin CHECK + INSERT SELECT + DROP + RENAME).
//
// Idempotencia: el runner ejecuta cada migración una sola vez (tracking _arckode_migrations).
// En una DB nueva el ORM crea la tabla sin CHECKs y esta migración es no-op efectiva
// (recrea con el mismo schema, preservando datos).
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE "housekeeping_new" (
    id TEXT PRIMARY KEY, "roomId" TEXT NOT NULL, "hotelId" TEXT NOT NULL,
    "staffId" TEXT, "type" TEXT DEFAULT 'full_cleaning', "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'pending', "notes" TEXT, "assignedDate" TEXT,
    "completedDate" TEXT, "cleaningItems" TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY ("hotelId") REFERENCES hotels(id),
    FOREIGN KEY ("roomId") REFERENCES rooms(id)
  )`)

  await db.run(`INSERT INTO "housekeeping_new"
    (id, "roomId", "hotelId", "staffId", "type", "priority", "status", "notes",
     "assignedDate", "completedDate", "cleaningItems", createdAt, updatedAt)
    SELECT id, "roomId", hotelId, "staffId", "type", "priority", "status", "notes",
     "assignedDate", "completedDate", "cleaningItems", createdAt, updatedAt
    FROM "housekeeping"`)

  await db.run(`DROP TABLE "housekeeping"`)
  await db.run(`ALTER TABLE "housekeeping_new" RENAME TO "housekeeping"`)
}

export async function down(_db: MigrationRunner): Promise<void> {
  // No-op: los CHECK restrictivos eran el bug; no se restauran.
}
