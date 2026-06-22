// migrate-english-values.ts — Pasa valores enum y DEFAULTs en español a inglés.
// 1) UPDATE filas existentes con valores enum en español.
// 2) Rebuild de tablas para cambiar DEFAULT 'español' → 'inglés'.
// Run: bun run migrate-english-values.ts [ruta_db]  (probar en copia primero)
import { Database } from "bun:sqlite"
import { join } from "path"

const DB_PATH = process.argv[2] ?? join(import.meta.dir, "data", "managerhotel.db")
const db = new Database(DB_PATH)

// Valor español → inglés (comprensivo, para datos existentes)
const VAL: Record<string, string> = {
  pendiente: "pending", confirmada: "confirmed", confirmado: "confirmed",
  abierta: "open", abierto: "open", cerrada: "closed", cerrado: "closed",
  activa: "active", activo: "active", inactiva: "inactive", inactivo: "inactive",
  disponible: "available", ocupada: "occupied", ocupado: "occupied",
  cancelada: "cancelled", cancelado: "cancelled", pagada: "paid", vencida: "overdue",
  alta: "high", media: "medium", baja: "low", urgente: "urgent",
  doble: "double", simple: "single", servicio: "service",
  directa: "direct", tecnico: "technical", integracion: "integration",
  consulta: "query", facturacion: "billing", climatizacion: "hvac",
  plomeria: "plumbing", electronica: "electronics", cerraduras: "locks",
  sistema: "system", completa: "completed",
}
const ENUM_COLS = ["status", "type", "priority", "category", "channel", "tier", "kind", "source", "plan", "role"]

// DEFAULT español → inglés (para rebuild de columnas)
const DEF: Record<string, string> = {
  doble: "double", disponible: "available", pendiente: "pending", directa: "direct",
  media: "medium", abierto: "open", tecnico: "technical", activo: "active", sistema: "system",
}

// ─── 1) UPDATE datos existentes ─────────────────────────────────
db.exec("PRAGMA foreign_keys=OFF")
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_new_%'").all().map((t: any) => t.name)
let dataFixed = 0
console.log("— Actualizando datos existentes —")
for (const t of tables) {
  const cols = db.query(`PRAGMA table_info("${t}")`).all().map((c: any) => c.name).filter((c: string) => ENUM_COLS.includes(c))
  for (const c of cols) {
    for (const [es, en] of Object.entries(VAL)) {
      const r = db.query(`SELECT COUNT(*) c FROM "${t}" WHERE "${c}"=?`).get(es) as any
      if (r.c > 0) {
        db.prepare(`UPDATE "${t}" SET "${c}"=? WHERE "${c}"=?`).run(en, es)
        dataFixed += r.c
        console.log(`  ${t}.${c}: ${r.c}× '${es}' → '${en}'`)
      }
    }
  }
}
console.log(`Datos actualizados: ${dataFixed} filas\n`)

// ─── 2) Rebuild DEFAULTs en español → inglés ────────────────────
console.log("— Rebuild de DEFAULTs en español —")
let defFixed = 0
function rebuild(t: string) {
  const orig = (db.query('SELECT sql FROM sqlite_master WHERE type="table" AND name=?').get(t) as any)?.sql as string
  if (!orig) return
  let ddl = orig
  let changed = false
  for (const [es, en] of Object.entries(DEF)) {
    const re = new RegExp(`(DEFAULT\\s*['"]${es}['"])`, "gi")
    if (re.test(ddl)) { ddl = ddl.replace(re, `DEFAULT '${en}'`); changed = true }
  }
  if (!changed) return
  ddl = ddl.replace(/CREATE TABLE\s+"?(\w+)"?\s*\(/i, (_m, n) => `CREATE TABLE "_new_${n}" (`)
  const cols = db.query(`PRAGMA table_info("${t}")`).all().map((c: any) => `"${c.name}"`).join(", ")
  db.exec(ddl)
  db.exec(`INSERT INTO "_new_${t}" (${cols}) SELECT ${cols} FROM "${t}"`)
  db.exec(`DROP TABLE "${t}"`)
  db.exec(`ALTER TABLE "_new_${t}" RENAME TO "${t}"`)
  defFixed++
  console.log(`  ✓ ${t}: DEFAULTs en inglés`)
}

db.exec("BEGIN")
try {
  for (const t of tables) rebuild(t)
  db.exec("COMMIT")
} catch (e: any) {
  db.exec("ROLLBACK"); console.log("💥 Rebuild falló:", e.message); db.close(); process.exit(1)
}
console.log(`Tablas con DEFAULT corregido: ${defFixed}\n`)

// ─── Verificación ───────────────────────────────────────────────
console.log("— Verificación —")
let remaining = 0
for (const t of tables) {
  const cols = db.query(`PRAGMA table_info("${t}")`).all() as any[]
  for (const c of cols.filter((c: any) => ENUM_COLS.includes(c.name))) {
    const vals = db.query(`SELECT DISTINCT "${c.name}" v FROM "${t}"`).all().map((r: any) => r.v)
    const es = vals.filter((v) => v != null && Object.keys(VAL).includes(String(v)))
    if (es.length) { console.log(`  ❌ ${t}.${c.name} aún tiene: ${JSON.stringify(es)}`); remaining++ }
  }
}
db.exec("PRAGMA foreign_keys=ON")
const fk = db.query("PRAGMA foreign_key_check").all()
const totalRows = tables.reduce((s, t) => s + (db.query(`SELECT COUNT(*) c FROM "${t}"`).get() as any).c, 0)
console.log(`  ${remaining === 0 ? "✓ Sin valores enum en español" : "⚠️ Quedan valores en español"}`)
console.log(`  ${fk.length === 0 ? "✓ FK check limpio" : "❌ " + fk.length + " violaciones FK"}`)
console.log(`  ✓ ${totalRows} filas totales preservadas`)
db.close()
