// Migration: add profession (plain text) and emergencyContact (json column:
// { name, phone, relation, email }) to guests. Cierra el estándar de datos del
// huésped: profesión + contacto de emergencia para el parte legal/CRM.
import type { ORM } from 'arckode-framework'

const COLUMNS = ['profession', 'emergencyContact']

export default async function up(orm: ORM) {
  const db = (orm as any).db ?? (orm as any).adapter?.db
  if (!db?.exec) return

  for (const col of COLUMNS) {
    try {
      db.exec(`ALTER TABLE guests ADD COLUMN ${col} TEXT`)
    } catch {
      // Column already exists — idempotente
    }
  }
}
