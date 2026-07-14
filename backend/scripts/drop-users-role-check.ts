// scripts/drop-users-role-check.ts — Elimina el CHECK vestigial de users.role.
//
// Un schema legacy dejó `CHECK (role IN ('super_admin',...,'housekeeping',...))` en la tabla users.
// Ese enum fijo es INCOMPATIBLE con el sistema de roles dinámicos: asignar un rol custom ("Gerente")
// o un rol del sistema que el CHECK no enumera ('housekeeper'/'supervisor') revienta con
// `CHECK constraint failed` → 500. El vocabulario válido se controla en la app (canAssignRole), no
// con un enum de DB. El modelo ORM actual NO define el CHECK, así que las DBs nuevas ya salen bien;
// esto limpia las DBs legacy.
//
// Idempotente: si no hay CHECK, no hace nada.
//
// SQLite (dev): recrea la tabla sin el CHECK, preservando datos e índices (SQLite no soporta
// DROP CHECK). Postgres (prod): imprime el ALTER a correr en el deploy — no se ejecuta DDL de PG a
// ciegas sobre datos productivos.

import { Database } from 'bun:sqlite'

const DATABASE_URL = process.env.DATABASE_URL
if (DATABASE_URL) {
  console.log('[PG] Motor Postgres detectado. Ejecutá manualmente en el deploy (idempotente):')
  console.log(`
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'users'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c); END IF;
END $$;`)
  process.exit(0)
}

const path = process.env.DB_PATH || './data/managerhotel.db'
const db = new Database(path)

const row = db.query("SELECT sql FROM sqlite_master WHERE name='users' AND type='table'").get() as { sql: string } | null
if (!row) { console.error('Tabla users no encontrada en', path); process.exit(1) }

if (!/CHECK\s*\(\s*role\s+IN/i.test(row.sql)) {
  console.log('✅ users.role no tiene CHECK — nada que hacer (idempotente).')
  process.exit(0)
}

// Quita la cláusula `CHECK (role IN (...)),` del DDL, preservando el resto tal cual.
const newTableDdl = row.sql.replace(/,?\s*CHECK\s*\(\s*role\s+IN\s*\([^)]*\)\s*\)/i, '')
if (newTableDdl === row.sql) { console.error('No se pudo remover el CHECK del DDL. Abortado.'); process.exit(1) }

// Columnas en orden, derivadas del DDL nuevo para copiar por nombre exacto.
const cols = (db.query("SELECT name FROM pragma_table_info('users')").all() as { name: string }[]).map(c => `"${c.name}"`).join(', ')
const indexes = (db.query("SELECT sql FROM sqlite_master WHERE tbl_name='users' AND type='index' AND sql IS NOT NULL").all() as { sql: string }[]).map(i => i.sql)

const before = (db.query('SELECT COUNT(*) c FROM users').get() as { c: number }).c

const ddlTemp = newTableDdl.replace(/CREATE TABLE "?users"?/i, 'CREATE TABLE users_new')

db.exec('PRAGMA foreign_keys=OFF')
db.exec('BEGIN')
try {
  db.exec(ddlTemp)
  db.exec(`INSERT INTO users_new (${cols}) SELECT ${cols} FROM users`)
  db.exec('DROP TABLE users')
  db.exec('ALTER TABLE users_new RENAME TO users')
  for (const idx of indexes) db.exec(idx)
  db.exec('COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
  console.error('Error, rollback:', (e as Error).message)
  process.exit(1)
}
db.exec('PRAGMA foreign_keys=ON')

const after = (db.query('SELECT COUNT(*) c FROM users').get() as { c: number }).c
const stillHasCheck = /CHECK\s*\(\s*role\s+IN/i.test((db.query("SELECT sql FROM sqlite_master WHERE name='users'").get() as { sql: string }).sql)

console.log(`✅ CHECK eliminado. users: ${before} → ${after} filas${before === after ? ' (ok)' : ' ⚠ DIFIEREN'}. CHECK presente: ${stillHasCheck}`)
if (before !== after || stillHasCheck) process.exit(1)
