// scripts/seed-subscription-categories.ts — Seed de las 3 filas de `special_category_config`
// (Fundador Uno, Fundador Dos, Pionero — PLAN-SUSCRIPCIONES.md §2 Grupo A).
//
// La TABLA la crea el ORM (modelo `SpecialCategoryConfig`, registrado por el módulo
// subscriptions vía RUN_MIGRATE=1). Este script SOLO inserta las 3 filas iniciales — después
// se editan desde /admin/subscriptions/founders-pioneers, nunca hardcodeadas en el código.
// Mismo patrón UNIVERSAL (Postgres + SQLite) e idempotente (COUNT por key) que
// seed-platform-email-templates.ts.
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

async function countByKey(key: string): Promise<number> {
  const rows = (await db.query('SELECT COUNT(*) as c FROM special_category_config WHERE key=?', [key])) as CountRow[]
  return rows[0]?.c ?? 0
}

interface CategorySeed {
  key: string
  totalSlots: number
  discountPct: number
  minPlanSortOrder: number | null
  sequenceGroup: string | null
  opensAfter: string | null
  status: 'closed' | 'open' | 'full'
}

// Valores confirmados en la reunión de negocio (PLAN-SUSCRIPCIONES.md §13). Editables después
// desde el admin — esto es solo el estado inicial, no una regla fija.
const CATEGORIES: CategorySeed[] = [
  {
    key: 'founder_one', totalSlots: 10, discountPct: 40, minPlanSortOrder: 1,
    sequenceGroup: 'founder-sequence', opensAfter: null, status: 'open',
  },
  {
    key: 'founder_two', totalSlots: 15, discountPct: 30, minPlanSortOrder: 1,
    sequenceGroup: 'founder-sequence', opensAfter: 'founder_one', status: 'closed',
  },
  {
    key: 'pioneer', totalSlots: 75, discountPct: 20, minPlanSortOrder: null,
    sequenceGroup: null, opensAfter: null, status: 'open',
  },
]

async function seed(): Promise<void> {
  await db.connect()
  let inserted = 0
  for (const c of CATEGORIES) {
    const count = await countByKey(c.key)
    if (count > 0) {
      console.log(`special_category_config: "${c.key}" ya existe, skip`)
      continue
    }
    await db.run(
      `INSERT INTO special_category_config
       (id, key, totalSlots, occupiedCount, discountPct, minPlanSortOrder, sequenceGroup, opensAfter, status, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), c.key, c.totalSlots, 0, c.discountPct, c.minPlanSortOrder, c.sequenceGroup, c.opensAfter, c.status, now(), now()],
    )
    console.log(`special_category_config: "${c.key}" insertado (${c.totalSlots} cupos, ${c.discountPct}%)`)
    inserted++
  }
  console.log(`✅ Seed completado (${inserted}/${CATEGORIES.length} insertados, resto ya existía)`)
  await db.close()
}

seed().catch((e) => { console.error('❌ Seed falló', e); process.exit(1) })
