// scripts/seed-hotel-slugs.ts — Idempotent seeder for `hotels.slug` (F0 solmi-direct-booking).
// Para cada hotel con `slug IS NULL`: slug = slugify(name) + (colisión ? '-<shortHash>' : '').
//
// Idempotente: `WHERE slug IS NULL OR slug = ''` — correr 2× NO cambia slugs ya poblados.
// Renombrar el hotel (name) NO toca el slug: la 2° corrida filtra los ya poblados y no los
// re-deriva (el slug es estable por diseño, D4 — es el namespace público del endpoint
// GET /api/public/hotels/:slug, no un display string).
//
// Multi-engine: usa los adapters del framework (mismo criterio que migrate-db.ts) —
// DATABASE_URL elige Postgres, DB_PATH SQLite. Placeholders `?` (PostgresAdapter convierte
// a `$N`). Columnas físicas en minúscula en ambos motores (`slug`, `id`, `name`) — sin quoting.
//
// PRE-REQUISITO: correr `RUN_MIGRATE=1 bun run src/composition-root.ts` ANTES — sin la
// columna `slug` física (añadida vía ADD COLUMN por ormMigrate 1.6.2 sobre el modelo
// `Hotels` en modules/hoteles/model.ts), el SELECT/UPDATE acá falla con "no such column".
//
// Uso:
//   bun run scripts/seed-hotel-slugs.ts                                  # SQLite (data/managerhotel.db)
//   DATABASE_URL=postgres://... bun run scripts/seed-hotel-slugs.ts      # Postgres
//   DB_PATH=/tmp/test.db bun run scripts/seed-hotel-slugs.ts             # SQLite custom path
import { createHash } from 'node:crypto'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'

// La interfaz DbAdapter del framework expone query/run/close pero NO connect(). Ambos
// adapters concretos implementan connect() y requieren ser conectados antes del primer
// query → tipamos como intersección (mismo patrón que migrate-db.ts).
const DATABASE_URL = process.env.DATABASE_URL
const db: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({
      path: process.env.DB_PATH || './data/managerhotel.db',
      wal: true,
      foreignKeys: true,
    })

interface HotelRow { id: string; name: string | null }
interface CountRow { c: number }

/**
 * slugify: lowercase + strip diacritics + non-alphanumeric → `-` + collapse + trim.
 * Ej. "Caribe Paraíso 5★" → "caribe-paraiso-5".
 * "Café à la page" → "cafe-a-la-page".
 */
function slugify(input: string): string {
  const lower = (input || '').toLowerCase()
  // NFD separa letras de combining marks (acentos, diéresis) → los stripamos.
  // La ç se descompone en c + cedilla combinante en NFD, queda "c". Aceptable.
  const withoutDiacritics = lower.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return withoutDiacritics
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric → guión
    .replace(/^-+|-+$/g, '')       // trim guiones bordes
    .replace(/-{2,}/g, '-')        // collapse duplicados (segunda pasada defensiva)
}

/** Hash determinístico corto (6 hex chars) para desambiguar colisiones de slug. */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 6)
}

async function main(): Promise<void> {
  await db.connect()

  // Solo hoteles sin slug — el WHERE ES la idempotencia. Correr 2× no toca nada poblado.
  const hotels = (await db.query(
    `SELECT id, name FROM hotels WHERE slug IS NULL OR slug = ''`
  )) as HotelRow[]

  if (hotels.length === 0) {
    console.log('✅ Todos los hoteles ya tienen slug — nada que hacer.')
    return
  }
  console.log(`Found ${hotels.length} hotel(es) sin slug.`)

  let populated = 0
  let collisions = 0
  let nameless = 0

  for (const hotel of hotels) {
    const base = slugify(hotel.name ?? '')

    // Nombre vacío / solo símbolos — fallback estable al hash del id (no del nombre).
    if (!base) {
      const fallback = `hotel-${shortHash(hotel.id)}`
      await db.run(`UPDATE hotels SET slug = ? WHERE id = ?`, [fallback, hotel.id])
      console.log(`  ⚠️ hotel ${hotel.id} sin nombre usable → slug='${fallback}'`)
      nameless++
      populated++
      continue
    }

    // Colisión: ¿ya existe OTRO hotel con ese slug? Incluye los que acabamos de updatear
    // en esta misma corrida (el UPDATE de A es visible para el SELECT de B dentro del loop).
    const countRows = (await db.query(
      `SELECT COUNT(*) as c FROM hotels WHERE slug = ?`,
      [base]
    )) as CountRow[]
    const exists = countRows[0]?.c ?? 0

    // Hash sobre hotel.id (no name) — así dos hoteles con el mismo nombre pero ids
    // distintos sufijan distinto, y recorrer el seeder produce el mismo slug ambas veces.
    const finalSlug = exists > 0 ? `${base}-${shortHash(hotel.id)}` : base
    if (exists > 0) collisions++

    await db.run(`UPDATE hotels SET slug = ? WHERE id = ?`, [finalSlug, hotel.id])
    console.log(
      `  ✓ ${hotel.name} → '${finalSlug}'${exists > 0 ? ' (colisión resuelta)' : ''}`
    )
    populated++
  }

  console.log(
    `\n✅ Seeder completado: ${populated} slug(s) poblados, ${collisions} colisión(es) resuelta(s)` +
      (nameless > 0 ? `, ${nameless} sin nombre (fallback hash)` : '') +
      '.'
  )
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seeder falló:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.close()
  })
