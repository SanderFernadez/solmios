// scripts/add-plan-stripe-price-id.ts — UNIVERSAL (PostgreSQL + SQLite vía DbAdapter del framework).
// Agrega `plans.stripePriceId` (nullable). Mismo criterio de adapter condicional que
// migrate-db.ts / composition-root.ts (DATABASE_URL -> Postgres, sino SQLite por DB_PATH).
//
// `stripePriceId` ya es un campo del modelo ORM `Plans` (src/shared/models.ts). El ORM crea la
// columna sin comillas, así que Postgres la pliega a minúsculas (stripepriceid) y el framework
// 1.6.2 remapea camelCase↔lowercase al leer/escribir — igual que el resto de columnas camelCase
// de esta tabla (isActive/sortOrder). Portable: sin PRAGMA ni SQL específico de un motor.
//
// Idempotente: ADD COLUMN reintenta y descarta el error si la columna ya existe (SQLSTATE
// 42701 en Postgres / "duplicate column" en SQLite — mismo criterio que migrate-db.ts).
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'

const DATABASE_URL = process.env.DATABASE_URL
const db: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({
      path: process.env.DB_PATH || './data/managerhotel.db',
      wal: true,
      foreignKeys: true,
    })

const PG_DUPLICATE_COLUMN = '42701'

function isAlreadyExistsError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code
  if (code === PG_DUPLICATE_COLUMN) return true
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return msg.includes('duplicate column') || msg.includes('already exists')
}

async function addColumnIfMissing(table: string, column: string, def: string): Promise<void> {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
    console.log(`✅ Columna ${table}.${column} agregada`)
  } catch (e: unknown) {
    if (!isAlreadyExistsError(e)) throw e
    console.log(`⚠️ Columna ${table}.${column} ya existe`)
  }
}

async function main(): Promise<void> {
  await db.connect()
  await addColumnIfMissing('plans', 'stripePriceId', 'TEXT')
  await db.close()
  console.log('✅ Migración completada')
}

main().catch((e) => {
  console.error('❌ Migración falló:', e)
  process.exit(1)
})
