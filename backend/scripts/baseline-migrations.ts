// scripts/baseline-migrations.ts — Adoption del sistema de migraciones versionadas.
//
// CONTEXTO: el runner de migraciones (arckode db:migrate) NUNCA se usó en este proyecto
// (_arckode_migrations no existía) porque el .env tenía vars MySQL/Postgres y mysql2 no
// estaba instalado → el runner moría. Las tablas se crearon vía migrate-db.ts + ORM sync.
//
// Ahora que el runner está arreglado (DB_PATH en .env), marcamos las migraciones EXISTENTES
// como ya-aplicadas: su schema ya está reflejado en la DB (CREATE TABLE IF NOT EXISTS + las
// columnas ALTER verificadas). Es el patrón estándar de "adoption" (Laravel/Rails sobre DB
// existente) — se declara el estado actual como baseline y a partir de acá se trackea.
//
// IDEMPOTENTE: INSERT OR IGNORE. Seguro para re-correr.
// USO: cd backend && bun run scripts/baseline-migrations.ts
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { readdirSync } from 'node:fs'

const db = new Database(join(import.meta.dir, '..', 'data', 'managerhotel.db'))

db.exec(`CREATE TABLE IF NOT EXISTS _arckode_migrations (
  name VARCHAR(255) PRIMARY KEY,
  direction VARCHAR(10) NOT NULL DEFAULT 'up',
  runAt VARCHAR(50) NOT NULL
)`)

const dir = join(import.meta.dir, '..', 'src', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.ts'))
const stamp = new Date().toISOString()

// El runner (arckode db:migrate) compara los nombres contra readdir(), que devuelve los
// archivos CON extensión .ts, y markApplied() guarda ese mismo nombre. Por eso acá se
// inserta el nombre con .ts — sin la extensión, ninguna migración coincidiría.
// Baseline one-off: reconstruimos _arckode_migrations desde el dir actual (state limpio).
db.exec("DELETE FROM _arckode_migrations")

for (const f of files) {
  db.query('INSERT INTO _arckode_migrations (name, direction, runAt) VALUES (?, ?, ?)').run(f, 'up', stamp)
}

const applied = (db.query("SELECT count(*) as n FROM _arckode_migrations WHERE direction='up'").get() as { n: number }).n
console.log(`✅ ${files.length} migraciones en src/migrations/ marcadas como aplicadas (con extensión .ts).`)
console.log(`   _arckode_migrations: ${applied} registros 'up'. Sistema de migraciones versionadas adoptado.`)
console.log('   Verificá con: arckode db:migrate status')
db.close()
