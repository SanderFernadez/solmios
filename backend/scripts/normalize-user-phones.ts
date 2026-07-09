// scripts/normalize-user-phones.ts
// Deja los teléfonos de `users` en dígitos planos (sin separadores ni código de país).
// El formato de presentación es cosa de la UI, no de la base.
//
// Idempotente: la segunda corrida no cambia nada.
//
//   DATABASE_URL=postgres://... bun run scripts/normalize-user-phones.ts        # Postgres
//   DB_PATH=data/managerhotel.db bun run scripts/normalize-user-phones.ts       # SQLite
//   ... --dry-run                                                               # no escribe
//
// El login ya normaliza al comparar, así que esto es higiene de datos: no es
// requisito para poder entrar.

import { Pool } from 'pg'
import { Database } from 'bun:sqlite'
import { normalizePhone } from '../src/modules/usuarios/usecases/normalize-phone'

const DRY_RUN = process.argv.includes('--dry-run')

interface Row { id: string; phone: string | null }

/** Decide qué filas cambian. Pura: sin esto no se puede testear ni revisar. */
function plan(rows: Row[]): { id: string; from: string; to: string }[] {
  const changes: { id: string; from: string; to: string }[] = []
  for (const row of rows) {
    const current = row.phone ?? ''
    if (current === '') continue
    const normalized = normalizePhone(current)
    if (normalized === '') {
      console.warn(`  ⚠ ${row.id}: "${current}" no tiene dígitos — se deja como está`)
      continue
    }
    if (normalized !== current) changes.push({ id: row.id, from: current, to: normalized })
  }
  return changes
}

function report(changes: { id: string; from: string; to: string }[], total: number): void {
  for (const c of changes) console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}"${c.from}" → "${c.to}"`)
  const prefix = DRY_RUN ? '[dry-run] ' : ''
  console.log(`\n${prefix}normalizados: ${changes.length} · sin cambios: ${total - changes.length} · total: ${total}`)
}

async function runPostgres(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString })
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT id, phone FROM users')
    const rows = result.rows as Row[]
    const changes = plan(rows)
    if (!DRY_RUN) {
      for (const c of changes) await client.query('UPDATE users SET phone = $1 WHERE id = $2', [c.to, c.id])
    }
    report(changes, rows.length)
  } finally {
    client.release()
    await pool.end()
  }
}

function runSqlite(path: string): void {
  const db = new Database(path)
  try {
    const rows = db.query('SELECT id, phone FROM users').all() as Row[]
    const changes = plan(rows)
    if (!DRY_RUN) {
      const stmt = db.prepare('UPDATE users SET phone = ? WHERE id = ?')
      for (const c of changes) stmt.run(c.to, c.id)
    }
    report(changes, rows.length)
  } finally {
    db.close()
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (url) return runPostgres(url)
  const path = process.env.DB_PATH
  if (path) return runSqlite(path)
  throw new Error('Definí DATABASE_URL (Postgres) o DB_PATH (SQLite)')
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('normalize-user-phones falló:', err); process.exit(1) })
