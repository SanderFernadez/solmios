// scripts/sync-system-roles.ts — Refresca los roles de sistema desde DEFAULT_ROLE_PERMISSIONS.
//
// Por qué existe: `loadPermissions` lee la tabla `roles` y sus permisos PISAN el mapa estático de
// `shared/permissions.ts`. `seed-default-roles.ts` hace `ON CONFLICT DO NOTHING`, así que un rol
// sembrado queda congelado con el default del día que se creó: editar `permissions.ts` no llega
// nunca a producción.
//
// Nunca pisa una personalización: ver `src/shared/usecases/role-sync.ts` para las reglas.
//
//   bun run scripts/sync-system-roles.ts            # dry-run: muestra el plan, no escribe
//   bun run scripts/sync-system-roles.ts --apply    # escribe
//
// Motor: DATABASE_URL → Postgres · DB_PATH → SQLite. Idempotente: correrlo dos veces no escribe la
// segunda vez.

import { DEFAULT_ROLE_PERMISSIONS } from '../src/shared/permissions'
import { planRoleSync, WRITES, type RoleRow, type RolePlan } from '../src/shared/usecases/role-sync'

const APPLY = process.argv.includes('--apply')

/** Postgres pliega los identificadores no entrecomillados a minúsculas; SQLite conserva el camelCase. */
function pick(row: Record<string, unknown>, name: string): unknown {
  const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? row[key] : undefined
}

/** El campo `permissions` puede llegar como array (json) o como string (text). */
function parsePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // JSON inválido: se trata como "sin permisos" y el plan lo mandará a revisión.
      return []
    }
  }
  return []
}

const toRoleRow = (row: Record<string, unknown>): RoleRow => ({
  id: String(pick(row, 'id')),
  name: String(pick(row, 'name')),
  system: Number(pick(row, 'system') ?? 0),
  hotelId: (pick(row, 'hotelId') as string) ?? null,
  permissions: parsePermissions(pick(row, 'permissions')),
  defaultsHash: (pick(row, 'defaultsHash') as string) ?? null,
})

interface Store {
  readRoles(): Promise<Record<string, unknown>[]>
  write(id: string, permissions: string[], hash: string): Promise<void>
  close(): Promise<void>
}

async function postgresStore(connectionString: string): Promise<Store> {
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString })
  return {
    readRoles: async () => (await pool.query('SELECT * FROM roles')).rows,
    write: async (id, permissions, hash) => {
      await pool.query(
        'UPDATE roles SET permissions = $1, defaultshash = $2, updatedat = $3 WHERE id = $4',
        [JSON.stringify(permissions), hash, new Date().toISOString(), id],
      )
    },
    close: () => pool.end(),
  }
}

async function sqliteStore(path: string): Promise<Store> {
  const { Database } = await import('bun:sqlite')
  const db = new Database(path)
  const cols = db.query('PRAGMA table_info(roles)').all() as { name: string }[]
  const col = (n: string) => cols.find((c) => c.name.toLowerCase() === n.toLowerCase())?.name ?? n
  return {
    readRoles: async () => db.query('SELECT * FROM roles').all() as Record<string, unknown>[],
    write: async (id, permissions, hash) => {
      db.query(
        `UPDATE roles SET ${col('permissions')} = ?, ${col('defaultsHash')} = ?, ${col('updatedAt')} = ? WHERE id = ?`,
      ).run(JSON.stringify(permissions), hash, new Date().toISOString(), id)
    },
    close: async () => db.close(),
  }
}

const ICON: Record<string, string> = {
  update: '🔄', stamp: '🏷️ ', 'up-to-date': '✅', 'skip-custom': '🔒', 'skip-unknown': '➖', review: '⚠️ ',
}

function report(plans: RolePlan[]): void {
  for (const p of plans) {
    const hotel = p.role.hotelId ? p.role.hotelId.slice(0, 8) : 'global'
    const perms = `${p.role.permissions.length}`.padStart(2)
    console.log(`  ${ICON[p.action]} ${p.role.name.padEnd(13)} ${hotel}  ${perms} perms  ${p.action.padEnd(12)} ${p.reason}`)
  }

  const review = plans.filter((p) => p.action === 'review')
  if (review.length > 0) {
    console.log(`\n⚠️  ${review.length} rol(es) sin huella y con permisos distintos al default.`)
    console.log('   No se tocan: puede ser un default viejo o una personalización, y no hay forma de saberlo.')
    console.log('   Si sabés que nadie los editó, comparalos a mano y actualizalos; el próximo sync ya los va a manejar.')
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  const store = url ? await postgresStore(url) : await sqliteStore(process.env.DB_PATH || './data/managerhotel.db')

  try {
    const rows = (await store.readRoles()).map(toRoleRow)
    const plans = planRoleSync(rows, DEFAULT_ROLE_PERMISSIONS)

    console.log(`\n${APPLY ? 'APLICANDO' : 'DRY-RUN (usá --apply para escribir)'} · ${rows.length} roles · motor ${url ? 'postgres' : 'sqlite'}\n`)
    report(plans)

    const writes = plans.filter((p) => WRITES.has(p.action))
    if (writes.length === 0) {
      console.log('\nNada que escribir.')
      return
    }

    if (!APPLY) {
      console.log(`\n${writes.length} fila(s) se escribirían. Volvé a correr con --apply.`)
      return
    }

    for (const p of writes) await store.write(p.role.id, p.nextPermissions!, p.nextHash!)
    console.log(`\n${writes.length} fila(s) actualizadas.`)
  } finally {
    await store.close()
  }
}

await main()
