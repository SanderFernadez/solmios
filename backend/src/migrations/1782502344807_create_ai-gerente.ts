// migrations/1782502344807_create_ai-gerente.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS ai_manager_interactions (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, userId TEXT NOT NULL,
    query TEXT NOT NULL, response TEXT NOT NULL, queryType TEXT,
    dataSourcesUsed TEXT, confidence REAL, feedback TEXT, responseTimeMs INTEGER,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS ai_manager_interactions`)
}
