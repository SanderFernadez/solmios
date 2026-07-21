// scripts/e2e/load-guests.e2e.ts — Carga de datos: 1000 huéspedes en base. QA-07 (#311).
//
// Siembra G huéspedes (directo por bun:sqlite, como el cleanup de core-flow) para el hotel del
// usuario logueado, y mide `GET /api/huespedes` en listado, paginación y búsqueda con volumen.
//
//   PORT=3001 bun run src/composition-root.ts        (en otra terminal)
//   bun run scripts/e2e/load-guests.e2e.ts
//
// Env: BASE_URL, DB_PATH, E2E_EMAIL, E2E_PASSWORD, G (default 1000), SAMPLES (default 15).

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'
const G = Number(process.env.G ?? 1000)
const SAMPLES = Number(process.env.SAMPLES ?? 15)

const stamp = Date.now()
const tag = `loadtest${String(stamp).slice(-8)}`   // prefijo reconocible para sembrar y limpiar
const db = new Database(DB_PATH)

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

let token = ''
const get = async (path: string) => {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const j = (await r.json().catch(() => ({}))) as any
  const rows = j?.data ?? j
  return { status: r.status, count: Array.isArray(rows) ? rows.length : (rows?.data?.length ?? 0), total: j?.total, ms: performance.now() - t0 }
}

// Mide un endpoint SAMPLES veces (con 1 warmup) y devuelve p50/p95 + la última respuesta.
const measure = async (label: string, path: string) => {
  await get(path) // warmup
  const times: number[] = []
  let last = await get(path)
  for (let i = 0; i < SAMPLES; i++) { last = await get(path); times.push(last.ms) }
  times.sort((a, b) => a - b)
  const p50 = percentile(times, 50), p95 = percentile(times, 95)
  console.log(`  ${label.padEnd(34)} p50=${p50.toFixed(0).padStart(4)}ms  p95=${p95.toFixed(0).padStart(4)}ms  → status ${last.status}, ${last.count} filas${last.total !== undefined ? ` (total=${last.total})` : ''}`)
  return { p50, p95, ...last }
}

let failed = false
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const lj = (await login.json()) as any
  token = lj?.data?.token
  const hotelId = lj?.data?.user?.hotelId
  if (!token || !hotelId) { console.error('❌ login falló'); process.exit(1) }
  console.log(`Login OK · hotelId=${hotelId}\n`)

  // Cuántos huéspedes ya hay (para reportar la degradación relativa).
  const baseline = (db.query('SELECT COUNT(*) c FROM guests WHERE hotelId=?').get(hotelId) as any).c
  console.log(`Sembrando ${G} huéspedes (baseline actual del hotel: ${baseline})…`)

  // Siembra en una transacción — 1000 INSERT sueltos serían lentísimos.
  const now = new Date().toISOString()
  const insert = db.prepare(
    'INSERT INTO guests (id, name, email, phone, document, nationality, hotelId, tier, active, loyaltyPoints, totalStays, totalSpent, createdAt, updatedAt) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  )
  const seed = db.transaction((count: number) => {
    for (let i = 0; i < count; i++) {
      insert.run(
        crypto.randomUUID(), `${tag} Guest ${i}`, `${tag}+${i}@load.test`, `809${String(1000000 + i)}`,
        `DOC${tag}${i}`, 'DO', hotelId, 'bronze', 1, 0, 0, 0, now, now,
      )
    }
  })
  const tSeed = performance.now()
  seed(G)
  console.log(`  ✅ ${G} sembrados en ${(performance.now() - tSeed).toFixed(0)}ms\n`)

  const totalNow = (db.query('SELECT COUNT(*) c FROM guests WHERE hotelId=?').get(hotelId) as any).c
  console.log(`Midiendo GET /api/huespedes con ${totalNow} huéspedes en el hotel (${SAMPLES} muestras c/u):`)

  const full = await measure('listado completo', '/api/huespedes')
  const page2 = await measure('paginado ?page=2&limit=50', '/api/huespedes?page=2&limit=50')
  const searchHit = await measure(`búsqueda ?search=${tag}`, `/api/huespedes?search=${tag}`)
  const searchRare = await measure('búsqueda término inexistente', `/api/huespedes?search=zzz${stamp}zzz`)

  // Criterios de aceptación
  console.log('\n— Criterios de aceptación —')
  const acStatus = full.status === 200 && page2.status === 200 && searchHit.status === 200
  console.log(`  ${acStatus ? '✅' : '❌'} listado/paginado/búsqueda responden 200 sin timeout`)
  const acSearch = searchHit.count >= G && searchRare.count === 0
  console.log(`  ${acSearch ? '✅' : '❌'} la búsqueda filtra (hit=${searchHit.count} ≥ ${G}, inexistente=${searchRare.count})`)
  const acLatency = full.p95 < 500
  console.log(`  ${acLatency ? '✅' : '⚠️ '} listado p95 = ${full.p95.toFixed(0)}ms ${acLatency ? '< 500ms' : '≥ 500ms — degrada con volumen'}`)
  if (!acStatus || !acSearch) failed = true

  // Hallazgo de perf: la paginación NO recorta la carga (huespedes.list hace findMany + filtro JS,
  // sin slice de page/limit). Con volumen esto se nota: page2 devuelve lo mismo que el listado full.
  console.log('\n— Observación de performance —')
  if (page2.count === full.count && full.count >= totalNow) {
    console.log(`  🐢 la paginación NO recorta: ?page=2 devolvió ${page2.count} filas (= listado completo).`)
    console.log('     huespedes/service.ts list() hace findMany(filters) + filtro en JS y retorna todo;')
    console.log('     no aplica offset/limit. Con miles de huéspedes cada request serializa la tabla entera.')
    console.log('     Fix: paginar en el repo (repo.paginate({hotelId},{offset,limit})) como reservas/crud.ts.')
  } else {
    console.log(`  ℹ️  page2=${page2.count} vs full=${full.count} — la paginación recorta la carga.`)
  }
} catch (e) {
  failed = true
  console.error('  ❌ excepción:', e)
} finally {
  // Limpieza: borra sólo lo sembrado por esta corrida (prefijo único).
  const del = db.run("DELETE FROM guests WHERE email LIKE ?", [`${tag}+%`])
  console.log(`\nLimpieza: ${del.changes} huéspedes de prueba eliminados.`)
  db.close()
}

console.log(`${'═'.repeat(60)}\n  ${failed ? '❌ con hallazgos' : '✅ carga de datos OK'}`)
process.exit(failed ? 1 : 0)
