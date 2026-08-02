// scripts/rollout-accounting-treasury-permissions.ts — GitLab #521 (CTG-2).
//
// Por qué existe: `permissions.ts` ya incluye accounting/treasury en `DEFAULT_ROLE_PERMISSIONS.
// hotel_admin`, pero en prod los permisos EFECTIVOS salen de la tabla `roles` (`loadPermissions`
// la lee y pisa el mapa estático). Las filas `hotel_admin` sembradas ANTES de que accounting/
// treasury existieran tienen el set viejo — y `sync-system-roles.ts --apply` las SALTA a propósito
// (van a `review`: sin `defaultsHash`, no puede saber si son un default viejo o una personalización,
// así que no las toca). Esa es la protección correcta para un refresco genérico; este script es el
// complemento angosto: SOLO agrega los 8 permisos de accounting/treasury si faltan, no toca nada
// más — no hay forma de que borre una personalización real.
//
// Alcance: hoteles cuyo plan incluye accounting O treasury en `plans.modules` (o `modules` vacío,
// que por convención de `shared/models.ts` significa "todos los módulos", ver comentario ahí).
// Un hotel que ya tiene los 8 permisos (el demo, o cualquiera re-corrido) queda sin cambios: la
// idempotencia es por permiso individual, no por fila completa.
//
//   bun run scripts/rollout-accounting-treasury-permissions.ts             # dry-run: muestra el plan
//   bun run scripts/rollout-accounting-treasury-permissions.ts --apply     # escribe
//
// Motor: DATABASE_URL → Postgres · DB_PATH → SQLite. HACER `pg_dump` ANTES de --apply en prod
// (ver Requisitos del issue #521) — este script no lo automatiza porque el dump vive fuera del
// alcance de un script de aplicación (credenciales/infra del servidor, no del ORM).

import { DEFAULT_ROLE_PERMISSIONS } from '../src/shared/permissions'

const APPLY = process.argv.includes('--apply')

// Única fuente de verdad de qué permisos son "de este rollout": se derivan del default real,
// no se hardcodean acá (si el día de mañana se agrega un accounting:algo nuevo, este script lo
// reconoce solo).
const TARGET_PERMS = DEFAULT_ROLE_PERMISSIONS.hotel_admin.filter(
  (p) => p.startsWith('accounting:') || p.startsWith('treasury:'),
)

/** Postgres pliega los identificadores no entrecomillados a minúsculas; SQLite conserva camelCase. */
function pick(row: Record<string, unknown>, name: string): unknown {
  const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? row[key] : undefined
}

/** `permissions`/`modules` pueden llegar como array (json nativo) o string (text/jsonb-as-text). */
function parseArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

interface HotelRow { id: string; name: string; plan: string }
interface PlanRow { slug: string; modules: string[] }
interface RoleRow { id: string; hotelId: string; permissions: string[] }

interface Store {
  readHotels(): Promise<HotelRow[]>
  readPlans(): Promise<PlanRow[]>
  readHotelAdminRoles(): Promise<RoleRow[]>
  writePermissions(id: string, permissions: string[]): Promise<void>
  close(): Promise<void>
}

async function postgresStore(connectionString: string): Promise<Store> {
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString })
  return {
    readHotels: async () =>
      (await pool.query('SELECT id, name, plan FROM hotels')).rows,
    readPlans: async () =>
      (await pool.query('SELECT slug, modules FROM plans')).rows.map((r: Record<string, unknown>) => ({
        slug: String(pick(r, 'slug')),
        modules: parseArray(pick(r, 'modules')),
      })),
    readHotelAdminRoles: async () =>
      (await pool.query("SELECT id, hotelid, permissions FROM roles WHERE name = 'hotel_admin'")).rows.map(
        (r: Record<string, unknown>) => ({
          id: String(pick(r, 'id')),
          hotelId: String(pick(r, 'hotelId')),
          permissions: parseArray(pick(r, 'permissions')),
        }),
      ),
    writePermissions: async (id, permissions) => {
      await pool.query('UPDATE roles SET permissions = $1, updatedat = $2 WHERE id = $3', [
        JSON.stringify(permissions),
        new Date().toISOString(),
        id,
      ])
    },
    close: () => pool.end(),
  }
}

async function sqliteStore(path: string): Promise<Store> {
  const { Database } = await import('bun:sqlite')
  const db = new Database(path)
  const rolesCols = (db.query('PRAGMA table_info(roles)').all() as { name: string }[])
  const col = (n: string) => rolesCols.find((c) => c.name.toLowerCase() === n.toLowerCase())?.name ?? n
  return {
    readHotels: async () => db.query('SELECT id, name, plan FROM hotels').all() as HotelRow[],
    readPlans: async () =>
      (db.query('SELECT slug, modules FROM plans').all() as Record<string, unknown>[]).map((r) => ({
        slug: String(r.slug),
        modules: parseArray(r.modules),
      })),
    readHotelAdminRoles: async () =>
      (db.query(`SELECT id, ${col('hotelId')} as hotelId, permissions FROM roles WHERE name = 'hotel_admin'`).all() as Record<
        string,
        unknown
      >[]).map((r) => ({
        id: String(r.id),
        hotelId: String(r.hotelId),
        permissions: parseArray(r.permissions),
      })),
    writePermissions: async (id, permissions) => {
      db.query(`UPDATE roles SET permissions = ?, ${col('updatedAt')} = ? WHERE id = ?`).run(
        JSON.stringify(permissions),
        new Date().toISOString(),
        id,
      )
    },
    close: async () => db.close(),
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  const store = url ? await postgresStore(url) : await sqliteStore(process.env.DB_PATH || './data/managerhotel.db')

  try {
    const [hotels, plans, roles] = await Promise.all([
      store.readHotels(),
      store.readPlans(),
      store.readHotelAdminRoles(),
    ])

    const planIncludesAccounting = (slug: string): boolean => {
      const plan = plans.find((p) => p.slug === slug)
      if (!plan) return false
      // Vacío = todos los módulos (retrocompat, ver shared/models.ts comentario en `Plans.modules`).
      return plan.modules.length === 0 || plan.modules.includes('accounting') || plan.modules.includes('treasury')
    }

    const eligibleHotelIds = new Set(hotels.filter((h) => planIncludesAccounting(h.plan)).map((h) => h.id))
    const hotelName = (id: string) => hotels.find((h) => h.id === id)?.name ?? id.slice(0, 8)

    const toUpdate = roles
      .filter((r) => eligibleHotelIds.has(r.hotelId))
      .map((r) => ({
        role: r,
        missing: TARGET_PERMS.filter((p) => !r.permissions.includes(p)),
      }))
      .filter((x) => x.missing.length > 0)

    console.log(
      `\n${APPLY ? 'APLICANDO' : 'DRY-RUN (usá --apply para escribir)'} · ${roles.length} roles hotel_admin · ` +
        `${eligibleHotelIds.size} hoteles elegibles · motor ${url ? 'postgres' : 'sqlite'}\n`,
    )

    if (toUpdate.length === 0) {
      console.log('Nada que actualizar: todos los hotel_admin elegibles ya tienen los 8 permisos.')
      return
    }

    for (const { role, missing } of toUpdate) {
      console.log(`  🔧 ${hotelName(role.hotelId).padEnd(28)} +${missing.length} permiso(s): ${missing.join(', ')}`)
    }

    if (!APPLY) {
      console.log(`\n${toUpdate.length} fila(s) se actualizarían. Hacé pg_dump y volvé a correr con --apply.`)
      return
    }

    for (const { role, missing } of toUpdate) {
      await store.writePermissions(role.id, [...role.permissions, ...missing])
    }
    console.log(`\n${toUpdate.length} fila(s) actualizadas.`)
  } finally {
    await store.close()
  }
}

await main()
