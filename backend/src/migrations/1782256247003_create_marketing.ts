// migrations/1782256247003_create_marketing.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS auto_messages (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, title TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6', emailSubject TEXT, emailBody TEXT,
    whatsappBody TEXT, channel TEXT DEFAULT 'email',
    triggerEvent TEXT NOT NULL DEFAULT 'checkin_day', triggerOffset INTEGER DEFAULT 0,
    variables TEXT, isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS message_logs (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, reservationId TEXT,
    messageId TEXT, messageType TEXT DEFAULT 'email', status TEXT DEFAULT 'pending',
    recipient TEXT, response TEXT, sentAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    body TEXT, category TEXT DEFAULT 'general', isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS whatsapp_templates`)
  await db.run(`DROP TABLE IF EXISTS message_logs`)
  await db.run(`DROP TABLE IF EXISTS auto_messages`)
}
