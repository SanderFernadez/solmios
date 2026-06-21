// db-optimize.ts — Optimiza el schema SQLite del ManagerHotel.
// 1) Rebuild de tablas: agrega FK + CHECK (enums) + NOT NULL(hotelId) vía inyección de DDL.
// 2) Agrega updatedAt faltantes.
// 3) Crea todos los índices (hotelId, FK columns, status, UNIQUE rooms).
// Uso: bun run db-optimize.ts [ruta_db].  Por defecto ./data/managerhotel.db
// PROBAR SIEMPRE EN COPIA PRIMERO.
import { Database } from "bun:sqlite"
import { join } from "path"

const DB_PATH = process.argv[2] ?? join(import.meta.dir, "data", "managerhotel.db")
const db = new Database(DB_PATH)
db.exec("PRAGMA foreign_keys=OFF")

// ─── Maps de constraints ────────────────────────────────────────
// CHECK: listas GENEROSAS (incluyen valores actuales en español + futuros ingleses).
const CHECKS: Record<string, string[]> = {
  rooms:          ["CHECK (status IN ('available','occupied','cleaning','maintenance','out_of_order','disponible'))","CHECK (type IN ('single','double','suite','family','queen','king'))"],
  reservations:   ["CHECK (status IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show'))","CHECK (currency IN ('USD','EUR','DOP','MXN','COP','ARS','CLP','PEN','BRL'))"],
  maintenance:    ["CHECK (status IN ('open','waiting','in_progress','closed','resolved'))","CHECK (priority IN ('low','medium','high','urgent'))"],
  invoices:       ["CHECK (status IN ('pending','paid','overdue','cancelled','draft'))","CHECK (type IN ('invoice','folio','payment','receipt','credit_note'))","CHECK (currency IN ('USD','EUR','DOP','MXN','COP','ARS','CLP','PEN','BRL'))"],
  guests:         ["CHECK (tier IN ('bronze','silver','gold','platinum','none'))"],
  housekeeping:   ["CHECK (status IN ('pending','in_progress','completed','cancelled'))","CHECK (priority IN ('low','medium','high'))"],
  tickets:        ["CHECK (status IN ('open','in_progress','resolved','closed','cancelled'))","CHECK (priority IN ('low','medium','high','urgent'))"],
  announcements:  ["CHECK (priority IN ('alta','baja','media','high','medium','low','urgent'))"],
  packages:       ["CHECK (type IN ('combo','servicio','upsell','service','package'))"],
  groups:         ["CHECK (status IN ('confirmada','pendiente','confirmed','pending','cancelled'))"],
  users:          ["CHECK (role IN ('super_admin','hotel_admin','receptionist','staff','housekeeping','maintenance','accountant'))"],
  hotels:         ["CHECK (status IN ('active','inactive','suspended','trial'))","CHECK (plan IN ('essential','starter','professional','enterprise','ultra'))"],
  reviews:        ["CHECK (rating BETWEEN 1 AND 5)"],
}

// FK: child.col → parent.col
const FKS: Record<string, string[]> = {
  rooms:          ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  reservations:   ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (roomId) REFERENCES rooms(id)","FOREIGN KEY (guestId) REFERENCES guests(id)"],
  invoices:       ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (reservationId) REFERENCES reservations(id)","FOREIGN KEY (guestId) REFERENCES guests(id)"],
  maintenance:    ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (roomId) REFERENCES rooms(id)"],
  reviews:        ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (guestId) REFERENCES guests(id)","FOREIGN KEY (reservationId) REFERENCES reservations(id)"],
  housekeeping:   ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (roomId) REFERENCES rooms(id)"],
  groups:         ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (leadGuestId) REFERENCES guests(id)"],
  guests:         ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  tickets:        ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (userId) REFERENCES users(id)"],
  notifications:  ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (userId) REFERENCES users(id)"],
  devices:        ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (userId) REFERENCES users(id)"],
  audit_log:      ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (userId) REFERENCES users(id)"],
  announcements:  ["FOREIGN KEY (hotelId) REFERENCES hotels(id)","FOREIGN KEY (authorId) REFERENCES users(id)"],
  api_keys:       ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  expenses:       ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  packages:       ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  configuration:  [], // sin FK: hotelId puede ser 'platform' (config global), no un hotel real
  channel_config: ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  roles:          ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
  users:          ["FOREIGN KEY (hotelId) REFERENCES hotels(id)"],
}

// Tablas donde hotelId DEBE ser NOT NULL (excluye users/roles que pueden ser globales)
const NOTNULL_HOTEL = new Set([
  "rooms","reservations","invoices","maintenance","reviews","housekeeping","groups",
  "guests","tickets","notifications","announcements","api_keys","expenses","packages",
  "configuration","channel_config","devices",
])

// ─── Helper: recontar filas ─────────────────────────────────────
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const safeIdent = (id: string): string => {
  if (!SAFE_IDENT.test(id)) throw new Error(`Invalid identifier: ${id}`)
  return `"${id}"`
}
const allTables = (): string[] =>
  db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_new_%' ORDER BY name").all().map((t: any) => t.name)
const rowCount = (t: string): number => (db.query(`SELECT COUNT(*) c FROM ${safeIdent(t)}`).get() as any).c

// ─── Snapshot de filas antes (para verificar) ───────────────────
const before: Record<string, number> = {}
for (const t of allTables()) before[t] = rowCount(t)
console.log(`Antes: ${Object.keys(before).length} tablas, ${Object.values(before).reduce((a, b) => a + b, 0)} filas en total`)

// ─── 1) REBUILD de tablas con FK + CHECK + NOT NULL ─────────────
function rebuild(table: string) {
  const checks = CHECKS[table] ?? []
  const fks = FKS[table] ?? []
  if (!checks.length && !fks.length && !NOTNULL_HOTEL.has(table)) return // nada que hacer

  const orig = (db.query('SELECT sql FROM sqlite_master WHERE type="table" AND name=?').get(table) as any)?.sql as string
  if (!orig) { console.log(`  ⚠️  ${table}: no se encontró DDL, salto`); return }

  // GUARD de idempotencia: ¿ya tiene los FKs que quiere, hotelId NN y los CHECKs?
  const fl = db.query(`PRAGMA foreign_key_list(${safeIdent(table)})`).all() as any[]
  const colsInfo = db.query(`PRAGMA table_info(${safeIdent(table)})`).all() as any[]
  const hotelNN = !NOTNULL_HOTEL.has(table) || colsInfo.find(c => c.name === "hotelId")?.notnull === 1
  const norm = (s: string) => s.replace(/\s+/g, " ")
  const checksDone = checks.every(ch => norm(orig).includes(norm(ch)))
  if (fl.length >= fks.length && hotelNN && checksDone) { console.log(`  · ${table}: ya optimizada, salto`); return }

  // a) forzar hotelId NOT NULL
  let ddl = orig
  if (NOTNULL_HOTEL.has(table)) {
    ddl = ddl.replace(/(\bhotelId\b\s+TEXT)(?!\s+NOT\s+NULL)/i, "$1 NOT NULL")
  }
  // b) inyectar CHECK + FK antes del último ')' (cierre de la tabla)
  const additions = [...checks, ...fks]
  if (additions.length) {
    const lastParen = ddl.lastIndexOf(")")
    if (lastParen === -1) { console.log(`  ⚠️  ${table}: DDL sin ')', salto`); return }
    const head = ddl.slice(0, lastParen).replace(/[\s,]+$/, "")
    const tail = ddl.slice(lastParen)
    ddl = head + ",\n  " + additions.join(",\n  ") + "\n" + tail
  }
  // c) renombrar destino a _new_<table>
  ddl = ddl.replace(/CREATE TABLE\s+"?(\w+)"?\s*\(/i, (_m, n) => `CREATE TABLE "_new_${n}" (`)

  const cols = (db.query(`PRAGMA table_info(${safeIdent(table)})`).all() as any[]).map(c => safeIdent(c.name))
  const colList = cols.join(", ")

  try {
    db.exec(ddl)
    db.exec(`INSERT INTO ${safeIdent('_new_' + table)} (${colList}) SELECT ${colList} FROM ${safeIdent(table)}`)
    db.exec(`DROP TABLE ${safeIdent(table)}`)
    db.exec(`ALTER TABLE ${safeIdent('_new_' + table)} RENAME TO ${safeIdent(table)}`)
    console.log(`  ✓ ${table}: FK×${fks.length} CHECK×${checks.length}${NOTNULL_HOTEL.has(table) ? " hotelIdNN" : ""}`)
  } catch (e: any) {
    console.log(`  ❌ ${table}: ${e.message.split("\n")[0]}`)
    throw e
  }
}

console.log("\n— Rebuild de tablas (FK + CHECK + NOT NULL) —")
db.exec("BEGIN")
try {
  for (const t of Object.keys({ ...CHECKS, ...FKS })) rebuild(t)
  db.exec("COMMIT")
} catch (e) {
  db.exec("ROLLBACK")
  console.log("\n💥 Rebuild falló — transacción revertida. DB intacta.")
  db.close(); process.exit(1)
}

// ─── 2) updatedAt faltantes (ALTER TABLE ADD COLUMN, seguro) ───
console.log("\n— updatedAt faltantes —")
const TS = "TEXT" // SQLite no permite ADD COLUMN con default no-constante; queda NULL en filas existentes (la app lo puebla).
for (const t of ["announcements", "api_keys", "devices", "packages"]) {
  const cols = (db.query(`PRAGMA table_info(${safeIdent(t)})`).all() as any[]).map(c => c.name)
  if (!cols.includes("updatedAt")) {
    db.exec(`ALTER TABLE ${safeIdent(t)} ADD COLUMN updatedAt ${TS}`)
    console.log(`  ✓ ${t}: +updatedAt`)
  } else {
    console.log(`  · ${t}: ya tiene updatedAt`)
  }
}

// ─── 2.5) Resolver huérfanos pre-existentes (que las nuevas FKs exponen) ──
console.log("\n— Resolución de huérfanos (FKs los exponen) —")
let orphanFixed = 0
for (const [table, fks] of Object.entries(FKS)) {
  for (const fk of fks) {
    const m = fk.match(/FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)/)
    if (!m) continue
    const [, col, parent, pcol] = m
    const colInfo = (db.query(`PRAGMA table_info(${safeIdent(table)})`).all() as any[]).find(c => c.name === col)
    const nullable = colInfo?.notnull !== 1
    const orphans = (db.query(`SELECT COUNT(*) c FROM ${safeIdent(table)} WHERE ${safeIdent(col)} IS NOT NULL AND ${safeIdent(col)} NOT IN (SELECT ${safeIdent(pcol)} FROM ${safeIdent(parent)})`).get() as any).c
    if (orphans === 0) continue
    if (nullable) {
      db.exec(`UPDATE ${safeIdent(table)} SET ${safeIdent(col)}=NULL WHERE ${safeIdent(col)} IS NOT NULL AND ${safeIdent(col)} NOT IN (SELECT ${safeIdent(pcol)} FROM ${safeIdent(parent)})`)
    } else {
      db.exec(`UPDATE ${safeIdent(table)} SET ${safeIdent(col)}=(SELECT ${safeIdent(pcol)} FROM ${safeIdent(parent)} LIMIT 1) WHERE ${safeIdent(col)} NOT IN (SELECT ${safeIdent(pcol)} FROM ${safeIdent(parent)})`)
    }
    orphanFixed += orphans
    console.log(`  ✓ ${table}.${col}: ${orphans} huérfano(s) → ${nullable ? "NULL" : "reparentado a "+parent+".("+pcol+")"}`)
  }
}
if (!orphanFixed) console.log("  · sin huérfanos")

// ─── 3) ÍNDICES (se recrean después del rebuild) ────────────────
console.log("\n— Índices —")
const idx = (name: string, sql: string) => {
  try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${sql}`); }
  catch (e: any) { console.log(`  ⚠️  ${name}: ${e.message.split("\n")[0]}`); return }
}
const hotelIdTables = allTables().filter(t => {
  const c = (db.query(`PRAGMA table_info(${safeIdent(t)})`).all() as any[]).map(x => x.name)
  return c.includes("hotelId")
})
let n = 0
for (const t of hotelIdTables) { idx(`idx_${t}_hotelId`, `${safeIdent(t)}(hotelId)`); n++ }
// FK columns
idx("idx_reservations_guestId", "reservations(guestId)")
idx("idx_reservations_roomId", "reservations(roomId)")
idx("idx_reservations_status", "reservations(status)")
idx("idx_invoices_reservationId", "invoices(reservationId)")
idx("idx_invoices_guestId", "invoices(guestId)")
idx("idx_invoices_status", "invoices(status)")
idx("idx_maintenance_roomId", "maintenance(roomId)")
idx("idx_maintenance_status", "maintenance(status)")
idx("idx_reviews_guestId", "reviews(guestId)")
idx("idx_reviews_reservationId", "reviews(reservationId)")
idx("idx_audit_log_userId", "audit_log(userId)")
idx("idx_devices_userId", "devices(userId)")
idx("idx_housekeeping_roomId", "housekeeping(roomId)")
idx("idx_housekeeping_staffId", "housekeeping(staffId)")
idx("idx_groups_leadGuestId", "groups(leadGuestId)")
idx("idx_notifications_userId", "notifications(userId)")
idx("idx_tickets_userId", "tickets(userId)")
idx("idx_tickets_status", "tickets(status)")
idx("idx_announcements_authorId", "announcements(authorId)")
// UNIQUE: número de habitación único por hotel
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_hotel_number ON rooms(hotelId, number)"); console.log("  ✓ idx_rooms_hotel_number (UNIQUE)"); }
catch (e: any) { console.log(`  ⚠️  idx_rooms_hotel_number: ${e.message.split("\n")[0]}`) }
console.log(`  ✓ ${n} índices hotelId + índices FK/status`)

// ─── Verificación ───────────────────────────────────────────────
console.log("\n— Verificación —")
let ok = true
const fkIssues = db.query("PRAGMA foreign_key_check").all() as any[]
if (fkIssues.length) {
  ok = false
  console.log(`  ❌ ${fkIssues.length} violaciones de FK:`)
  for (const r of fkIssues.slice(0, 10)) console.log("     ", r)
} else {
  console.log("  ✓ PRAGMA foreign_key_check: sin violaciones")
}
let lost = 0
for (const t of Object.keys(before)) {
  const now2 = rowCount(t)
  if (now2 !== before[t]) { console.log(`  ❌ ${t}: ${before[t]} → ${now2} filas (pérdida!)`); lost++; ok = false }
}
if (!lost) console.log("  ✓ Conteo de filas preservado en todas las tablas")

db.exec("PRAGMA foreign_keys=ON")
const fkTotal = allTables().reduce((acc, t) => acc + (db.query(`PRAGMA foreign_key_list(${safeIdent(t)})`).all() as any[]).length, 0)
console.log(`  ✓ FKs declaradas en total: ${fkTotal}`)

db.close()
console.log(ok ? "\n✅ Optimización completa y verificada" : "\n⚠️  Optimización con advertencias — revisar arriba")
