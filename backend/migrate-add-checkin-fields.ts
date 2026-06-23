// migrate-add-checkin-fields.ts — Agrega columnas de check-in real a la tabla reservations.
// Idempotente: verifica PRAGMA table_info antes de ALTER (SQLite no soporta ADD COLUMN IF NOT EXISTS).
// Run: bun run migrate-add-checkin-fields.ts [ruta_db]
import { Database } from 'bun:sqlite'
import { join } from 'path'

const DB_PATH = process.argv[2] ?? join(import.meta.dir, 'data', 'managerhotel.db')
const db = new Database(DB_PATH)

const existing = new Set(db.query('PRAGMA table_info(reservations)').all().map((c: any) => c.name))

const toAdd: Array<[string, string]> = [
  ['checkedInAt', 'TEXT'],
  ['checkedOutAt', 'TEXT'],
  ['folioId', 'TEXT'],
]

let added = 0
for (const [name, def] of toAdd) {
  if (existing.has(name)) {
    console.log(`  · ${name} ya existe — skip`)
    continue
  }
  db.exec(`ALTER TABLE reservations ADD COLUMN "${name}" ${def}`)
  console.log(`  ✓ agregada columna ${name} (${def})`)
  added++
}
console.log(`\nMigración completa — ${added} columnas agregadas.`)
db.close()
