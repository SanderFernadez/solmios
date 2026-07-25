// scripts/seed-referral-tiers.ts — Seed de los 5 tramos escalonados de `referral_tiers`
// (PLAN-REFERIDOS.md §3). Mismo patrón UNIVERSAL (Postgres + SQLite) e idempotente que
// seed-subscription-categories.ts. La TABLA la crea el ORM (RUN_MIGRATE=1), acá solo se
// insertan las filas iniciales — después se editan desde /admin/referrals, nunca hardcodeadas.
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'

const DATABASE_URL = process.env.DATABASE_URL
const db: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({ path: process.env.DB_PATH || './data/managerhotel.db', wal: true, foreignKeys: true })

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

interface CountRow { c: number }

async function countByFromCount(fromCount: number): Promise<number> {
  const rows = (await db.query('SELECT COUNT(*) as c FROM referral_tiers WHERE fromCount=?', [fromCount])) as CountRow[]
  return rows[0]?.c ?? 0
}

interface TierSeed { fromCount: number; monthsGranted: number; sortOrder: number }

// Valores confirmados en la reunión de negocio (PLAN-REFERIDOS.md §"Escala de meses
// gratuitos"): 1er y 2do referido = 1 mes, 3ro y 4to = 2 meses, 5to en adelante = 3 meses.
const TIERS: TierSeed[] = [
  { fromCount: 1, monthsGranted: 1, sortOrder: 1 },
  { fromCount: 2, monthsGranted: 1, sortOrder: 2 },
  { fromCount: 3, monthsGranted: 2, sortOrder: 3 },
  { fromCount: 4, monthsGranted: 2, sortOrder: 4 },
  { fromCount: 5, monthsGranted: 3, sortOrder: 5 },
]

async function seed(): Promise<void> {
  await db.connect()
  let inserted = 0
  for (const t of TIERS) {
    const count = await countByFromCount(t.fromCount)
    if (count > 0) {
      console.log(`referral_tiers: fromCount=${t.fromCount} ya existe, skip`)
      continue
    }
    await db.run(
      `INSERT INTO referral_tiers (id, fromCount, monthsGranted, sortOrder, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?)`,
      [uuid(), t.fromCount, t.monthsGranted, t.sortOrder, now(), now()],
    )
    console.log(`referral_tiers: fromCount=${t.fromCount} insertado (${t.monthsGranted} meses)`)
    inserted++
  }
  console.log(`✅ Seed completado (${inserted}/${TIERS.length} insertados, resto ya existía)`)
  await db.close()
}

seed().catch((e) => { console.error('❌ Seed falló', e); process.exit(1) })
