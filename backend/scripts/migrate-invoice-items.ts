// One-off: migra los items embebidos en invoices.notes a filas de invoice_items.
// Para facturas sin ": $Monto" desglosado, crea 1 item con el total y descripción inferida.
// Idempotente: saltea facturas que ya tienen items en la tabla.
import { Database } from 'bun:sqlite'

const dbPath = 'data/managerhotel.db'
const db = new Database(dbPath)

const invoices = db
  .query("SELECT id, hotelId, amount, notes, type FROM invoices WHERE type IN ('invoice','folio','receipt','credit_note')")
  .all() as Array<{ id: string; hotelId: string; amount: number; notes: string | null; type: string }>

let migrated = 0
for (const inv of invoices) {
  const existing = db.query('SELECT COUNT(*) as c FROM invoice_items WHERE invoiceId = ?').get(inv.id) as { c: number }
  if (existing.c > 0) continue

  const notes = inv.notes || ''
  const items: Array<{ description: string; amount: number }> = []

  // Formato viejo del frontend: "Concepto1: $10 · Concepto2: $20 · ..."
  for (const seg of notes.split('·').map((s) => s.trim())) {
    const m = seg.match(/^(.+?):\s*\$?([\d.,]+)$/)
    if (m) items.push({ description: m[1].trim(), amount: Number(m[2].replace(/[.,]/g, '')) / 100 || Number(m[2]) })
  }

  // Sin items desglosados → 1 item con el total y descripción inferida por keyword.
  if (!items.length) {
    const low = notes.toLowerCase()
    let desc = 'Servicio'
    if (low.includes('minibar')) desc = 'Minibar'
    else if (low.includes('hospedaje') || low.includes('habitacion') || low.includes('habitación')) desc = 'Hospedaje'
    else if (low.includes('restaurante') || low.includes('restaurant')) desc = 'Restaurante'
    else if (low.includes('spa')) desc = 'Spa'
    else if (low.includes('lavanderia') || low.includes('lavandería')) desc = 'Lavandería'
    items.push({ description: desc, amount: Number(inv.amount) || 0 })
  }

  const stmt = db.prepare(
    'INSERT INTO invoice_items (id, invoiceId, hotelId, description, quantity, unitPrice, amount, sortOrder) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
  )
  items.forEach((it, i) => {
    stmt.run(crypto.randomUUID(), inv.id, inv.hotelId, it.description, it.amount, it.amount, i)
  })
  console.log(`✓ ${inv.type} ${inv.id}: ${items.length} item(s) → ${items.map((i) => `${i.description}=$${i.amount}`).join(', ')}`)
  migrated++
}

console.log(`\nMigración completa: ${migrated} factura(s) migradas.`)
db.close()
