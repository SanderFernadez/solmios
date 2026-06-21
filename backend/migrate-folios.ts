// migrate-folios.ts — Crea las tablas de folios (cabecera + líneas). Idempotente.
// Modelo real: un folio acumula cargos/pagos por reserva; al cerrarse genera una factura.
// Run: cd backend && bun run migrate-folios.ts
import { Database } from "bun:sqlite"
import { join } from "path"

const db = new Database(join(import.meta.dir, "data", "managerhotel.db"))
db.exec("PRAGMA foreign_keys=ON")
const exec = (sql: string) => { try { db.exec(sql) } catch (e: any) { if (!e.message.includes("already exists")) throw e } }

exec(`CREATE TABLE IF NOT EXISTS folios (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  reservationId TEXT,
  guestId TEXT,
  roomId TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  currency TEXT NOT NULL DEFAULT 'USD',
  invoiceId TEXT,
  openedAt TEXT,
  closedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hotelId) REFERENCES hotels(id),
  FOREIGN KEY (reservationId) REFERENCES reservations(id),
  FOREIGN KEY (guestId) REFERENCES guests(id),
  FOREIGN KEY (roomId) REFERENCES rooms(id),
  FOREIGN KEY (invoiceId) REFERENCES invoices(id),
  CHECK (status IN ('open','closed','void'))
)`)

exec(`CREATE TABLE IF NOT EXISTS folio_charges (
  id TEXT PRIMARY KEY,
  folioId TEXT NOT NULL,
  hotelId TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  kind TEXT NOT NULL DEFAULT 'charge',
  quantity INTEGER NOT NULL DEFAULT 1,
  amount REAL NOT NULL,
  taxes REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  postedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (folioId) REFERENCES folios(id) ON DELETE CASCADE,
  FOREIGN KEY (hotelId) REFERENCES hotels(id),
  CHECK (kind IN ('charge','payment')),
  CHECK (category IN ('room','minibar','restaurant','spa','laundry','phone','payment','tax','other'))
)`)

// Índices
exec(`CREATE INDEX IF NOT EXISTS idx_folios_hotelId ON folios(hotelId)`)
exec(`CREATE INDEX IF NOT EXISTS idx_folios_reservationId ON folios(reservationId)`)
exec(`CREATE INDEX IF NOT EXISTS idx_folios_status ON folios(status)`)
exec(`CREATE INDEX IF NOT EXISTS idx_folio_charges_folioId ON folio_charges(folioId)`)
exec(`CREATE INDEX IF NOT EXISTS idx_folio_charges_hotelId ON folio_charges(hotelId)`

)

const fc = (db.query("SELECT COUNT(*) c FROM folios").get() as any).c
const fcc = (db.query("SELECT COUNT(*) c FROM folio_charges").get() as any).c
console.log(`✅ Tablas listas — folios: ${fc}, folio_charges: ${fcc}`)
db.close()
