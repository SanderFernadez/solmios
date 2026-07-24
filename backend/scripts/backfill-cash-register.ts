// scripts/backfill-cash-register.ts — Backfill de `register` en filas creadas ANTES de esta
// columna (SQLite). El ORM_MIGRATE hace `ALTER TABLE ... ADD COLUMN` sin DEFAULT (a diferencia
// del CREATE TABLE inicial) — las filas existentes quedan con register=NULL, invisibles tanto
// en la caja de recepción como en la del restaurante (ambas filtran por igualdad estricta,
// y NULL = 'reception' nunca es true en SQL). QA-ALTO encontrado en vivo contra la DB real.
import { Database } from 'bun:sqlite'

const db = new Database('data/managerhotel.db')

const movs = db.run(`UPDATE cash_movements SET register = 'reception' WHERE register IS NULL`)
console.log(`✅ ${movs.changes} cash_movements con register=NULL → 'reception'`)

const shifts = db.run(`UPDATE cash_shifts SET register = 'reception' WHERE register IS NULL`)
console.log(`✅ ${shifts.changes} cash_shifts con register=NULL → 'reception'`)

db.close()
console.log('✅ Backfill completado')
