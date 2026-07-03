// migrations/1782702344807_add_isdemo_to_users.ts
// Añade la columna isDemo a users y marca las cuentas demo existentes (seed data).
// El endpoint público /api/public/users consulta WHERE isDemo=1 — sin lista hardcodeada.
// Idempotente: SQLite no soporta ADD COLUMN IF NOT EXISTS → se atrapa el error si ya existe.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

// Seed data: cuentas demo iniciales marcadas como visibles en el login.
// Son constantes sembradas (no hardcodeo de lógica/config en runtime).
const DEMO_EMAILS = ['admin@solmios.com', 'admin@caribeparadise.com', 'maria@caribeparadise.com']

export async function up(db: MigrationRunner): Promise<void> {
  try {
    await db.run(`ALTER TABLE users ADD COLUMN isDemo INTEGER DEFAULT 0`)
  } catch {
    // La columna ya existe — idempotente.
  }
  // Marca las cuentas demo conocidas. Emails controlados (constantes), no user input.
  const inList = DEMO_EMAILS.map((e) => `'${e.replace(/'/g, "''")}'`).join(',')
  await db.run(`UPDATE users SET isDemo = 1 WHERE email IN (${inList})`)
}

export async function down(_db: MigrationRunner): Promise<void> {
  // SQLite no soporta DROP COLUMN de forma portable; no-op (la columna es inofensiva).
}
