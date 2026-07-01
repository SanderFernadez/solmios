// Migration: create invoice_items table (structured invoice line items).
// Before this, items were embedded as a string in invoices.notes and the print template
// could only render a single line with the total. Now each item is its own row, enabling
// a real line-by-line breakdown in the invoice print/PDF.
import type { ORM } from 'arckode-framework'

export default async function up(orm: ORM) {
  const db = (orm as any).db ?? (orm as any).adapter?.db
  if (!db?.exec) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      hotelId TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      amount REAL NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (invoiceId) REFERENCES invoices(id),
      FOREIGN KEY (hotelId) REFERENCES hotels(id)
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_hotelId ON invoice_items(hotelId);
  `)
}
