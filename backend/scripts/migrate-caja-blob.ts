// scripts/migrate-caja-blob.ts — One-off: migra configuration.caja_movements (blob JSON) → cash_movements.
//
// El módulo caja ORIGINAL guardaba los movimientos como un array JSON creciente en la tabla
// `configuration` (key='caja_movements'). Esta migración los pasa a la tabla propia cash_movements.
//
// - NO destructivo: NO borra el blob (queda como backup en configuration).
// - Idempotente: por hotel, si ya hay filas source='migrated' → skip.
// - Normaliza method español→inglés (efectivo→cash, tarjeta→card, ...).
//
// Uso: cd backend && bun run scripts/migrate-caja-blob.ts
// Correr DESPUÉS de que las tablas existan (arrancar el backend una vez con CashModule, o aplicar la migración versionada).

import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const db = new Database(join(import.meta.dir, '..', 'data', 'managerhotel.db'))

// Asegura que la tabla exista (autónomo respecto del orden de arranque).
db.run(`CREATE TABLE IF NOT EXISTS "cash_movements" (
  id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, shiftId TEXT,
  "type" TEXT NOT NULL, "amount" REAL NOT NULL, "method" TEXT,
  "concept" TEXT, "category" TEXT DEFAULT 'general', "source" TEXT DEFAULT 'manual',
  "guestName" TEXT, "roomNumber" TEXT, "reservationId" TEXT, "folioId" TEXT,
  "paymentId" TEXT, "reference" TEXT, "createdBy" TEXT, "notes" TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT
)`)

const METHOD_MAP: Record<string, string> = {
  efectivo: 'cash',
  tarjeta: 'card',
  transferencia: 'transfer',
  paypal: 'other',
  'link de pago': 'link',
}
function normalizeMethod(m?: string): string {
  if (!m) return 'cash'
  return METHOD_MAP[m.toLowerCase().trim()] || 'cash'
}

const insert = db.prepare(`INSERT INTO "cash_movements"
  (id, hotelId, type, amount, method, concept, category, source, guestName, roomNumber, createdAt, updatedAt)
  VALUES (?, ?, 'income', ?, ?, ?, 'payment', 'migrated', ?, ?, ?, ?)`)
const countMigrated = db.prepare(`SELECT COUNT(*) as c FROM "cash_movements" WHERE hotelId = ? AND source = 'migrated'`)

const rows = db.prepare(`SELECT hotelId, value FROM configuration WHERE key = 'caja_movements'`).all() as { hotelId: string; value: string }[]

if (rows.length === 0) {
  console.log('ℹ️  No se encontró configuration.caja_movements — nada que migrar.')
  db.close()
  process.exit(0)
}

let total = 0
for (const row of rows) {
  const already = (countMigrated.get(row.hotelId) as { c: number }).c
  if (already > 0) {
    console.log(`Hotel ${row.hotelId}: ya migrado (${already} filas) — skip`)
    continue
  }
  let entries: unknown[] = []
  try {
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
    if (Array.isArray(parsed)) entries = parsed
  } catch {
    console.log(`Hotel ${row.hotelId}: blob inválido — skip`)
    continue
  }
  for (const e of entries as any[]) {
    const created = e.createdAt || new Date().toISOString()
    insert.run(
      randomUUID(), row.hotelId, Number(e.amount) || 0, normalizeMethod(e.method),
      e.concept || 'Migrado', e.guestName || null, e.roomNumber || null, created, created,
    )
    total++
  }
  console.log(`Hotel ${row.hotelId}: ${entries.length} entradas migradas`)
}

console.log(`✅ Migración completa: ${total} movimientos a cash_movements.`)
console.log(`   El blob configuration.caja_movements se conservó como backup (no se borró).`)
db.close()
