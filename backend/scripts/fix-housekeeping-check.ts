// scripts/fix-housekeeping-check.ts — Fix one-off (data-migration).
//
// PROBLEMA: la tabla `housekeeping` fue creada por una versión vieja del modelo
// con CHECK constraints que rechazan status='inspected' y priority='urgent':
//   CHECK (status IN ('pending','in_progress','completed','cancelled'))  — sin 'inspected'
//   CHECK (priority IN ('low','medium','high'))                          — sin 'urgent'
// Pero validator (schema.ts), model.ts y el frontend SÍ usan esos valores →
// PUT/POST con inspected/urgent => HTTP 500 "Error interno del servidor".
// Además el DEFAULT de `type` estaba en español ('limpieza_completa'), violando DB English Only.
//
// Una DB NUEVA no tiene este bug (el modelo actual no define CHECKs). Este script
// corrige DBs EXISTENTES (dev/staging/prod creadas antes).
//
// SQLite no soporta ALTER DROP CHECK → se recrea la tabla (patrón estándar SQLite:
// CREATE new sin CHECK + INSERT SELECT + DROP + RENAME). La validación de enums ya la
// hace validateSchema() en el controller (patrón arckode: no duplicar validación en DB).
//
// IDEMPOTENTE: si la tabla ya no tiene CHECK, no hace nada. Seguro para re-correr.
// USO: cd backend && bun run scripts/fix-housekeeping-check.ts
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

const db = new Database(join(import.meta.dir, '..', 'data', 'managerhotel.db'))

const row = db
  .query("SELECT sql FROM sqlite_master WHERE type='table' AND name='housekeeping'")
  .get() as { sql: string } | null

if (!row?.sql) {
  console.log('⚠️  La tabla housekeeping no existe. Nada que hacer (se creará vía ORM).')
  process.exit(0)
}

if (!row.sql.includes('CHECK')) {
  console.log('✅ La tabla housekeeping ya está sin CHECK constraints. Nada que hacer.')
  process.exit(0)
}

console.log('🔧 housekeeping tiene CHECK restrictivos (rechazan inspected/urgent). Recreando tabla...')

db.exec('BEGIN')
try {
  // 1. Tabla nueva con schema correcto: sin CHECKs, defaults en INGLÉS, FKs preservadas.
  db.exec(`CREATE TABLE "housekeeping_new" (
    id TEXT PRIMARY KEY, "roomId" TEXT NOT NULL, "hotelId" TEXT NOT NULL,
    "staffId" TEXT, "type" TEXT DEFAULT 'full_cleaning', "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'pending', "notes" TEXT, "assignedDate" TEXT,
    "completedDate" TEXT, "cleaningItems" TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY ("hotelId") REFERENCES hotels(id),
    FOREIGN KEY ("roomId") REFERENCES rooms(id)
  )`)

  // 2. Copiar todos los registros existentes (columnas coinciden 1:1 por nombre).
  db.exec(`INSERT INTO "housekeeping_new"
    (id, "roomId", "hotelId", "staffId", "type", "priority", "status", "notes",
     "assignedDate", "completedDate", "cleaningItems", createdAt, updatedAt)
    SELECT id, "roomId", hotelId, "staffId", "type", "priority", "status", "notes",
     "assignedDate", "completedDate", "cleaningItems", createdAt, updatedAt
    FROM "housekeeping"`)

  const count = (db.query('SELECT count(*) as n FROM housekeeping_new').get() as { n: number }).n

  // 3. Reemplazar.
  db.exec('DROP TABLE "housekeeping"')
  db.exec('ALTER TABLE "housekeeping_new" RENAME TO "housekeeping"')
  db.exec('COMMIT')

  console.log(`✅ Tabla recreada sin CHECKs. ${count} registros preservados.`)
  console.log('   status ahora acepta: pending, in_progress, completed, inspected')
  console.log('   priority ahora acepta: low, medium, high, urgent')
} catch (e) {
  db.exec('ROLLBACK')
  console.error('❌ Error recreando tabla:', (e as Error).message)
  process.exit(1)
}

db.close()
