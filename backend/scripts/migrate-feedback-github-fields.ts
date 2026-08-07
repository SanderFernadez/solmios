// scripts/migrate-feedback-github-fields.ts — UNIVERSAL (PostgreSQL + SQLite vía DbAdapter).
//
// feedback_pins.gitlabIssueUrl/gitlabIssueId (feedback → GitLab, ver módulo feedback) migraron a
// githubIssueUrl/githubIssueId cuando el feedback pasó a crear issues en GitHub en vez de GitLab.
// Las columnas nuevas ya las agrega RUN_MIGRATE (están en el modelo ORM, `ADD COLUMN` automático)
// — este script hace la parte que RUN_MIGRATE NO hace: copiar los datos viejos y dropear las
// columnas huérfanas (ver "Anti-patrón ORM" / "Renombrar un campo" en CLAUDE.md).
//
// Idempotente: si ya no hay columnas `gitlab*` (ya corrida antes), no hace nada.
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

function isMissingColumnError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return msg.includes('no such column') || msg.includes('does not exist') || msg.includes('undefined column')
}

async function main(): Promise<void> {
  await db.connect()

  try {
    const result = await db.run(`
      UPDATE feedback_pins
         SET githubIssueUrl = gitlabIssueUrl, githubIssueId = gitlabIssueId
       WHERE gitlabIssueUrl IS NOT NULL AND githubIssueUrl IS NULL
    `)
    console.log(`✅ Datos copiados gitlabIssue* → githubIssue* (${(result as any)?.changes ?? '?'} filas)`)
  } catch (e) {
    if (!isMissingColumnError(e)) throw e
    console.log('⚠️ Columnas gitlabIssue* ya no existen — nada que copiar (idempotente).')
    await db.close()
    return
  }

  for (const col of ['gitlabIssueUrl', 'gitlabIssueId']) {
    try {
      await db.run(`ALTER TABLE feedback_pins DROP COLUMN ${col}`)
      console.log(`✅ Columna feedback_pins.${col} eliminada`)
    } catch (e) {
      if (!isMissingColumnError(e)) throw e
      console.log(`⚠️ Columna feedback_pins.${col} ya no existe`)
    }
  }

  await db.close()
  console.log('✅ Migración completada')
}

main().catch((e) => {
  console.error('❌ Migración falló:', e)
  process.exit(1)
})
