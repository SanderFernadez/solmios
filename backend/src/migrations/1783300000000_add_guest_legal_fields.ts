// Migration: add legal/CRM fields to guests (sex, country, address, city, province,
// documentType, documentIssueDate, communicateClient) — alinea guests con el estándar
// del formulario de reservas (reservations/index.vue) y con el Guest type del frontend.
import type { ORM } from 'arckode-framework'

const COLUMNS = [
  'sex',
  'country',
  'address',
  'city',
  'province',
  'documentType',
  'documentIssueDate',
  'communicateClient',
]

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
