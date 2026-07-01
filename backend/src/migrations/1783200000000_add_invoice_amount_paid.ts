// Migration: add amountPaid to invoices for partial payment support
import type { ORM } from 'arckode-framework'

export default async function up(orm: ORM) {
  const db = (orm as any).db ?? (orm as any).adapter?.db
  if (!db?.exec) return

  try {
    db.exec(`ALTER TABLE invoices ADD COLUMN amountPaid REAL DEFAULT 0`)
  } catch {
    // Column already exists
  }
}
