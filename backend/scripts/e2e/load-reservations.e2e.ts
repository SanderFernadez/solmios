// scripts/e2e/load-reservations.e2e.ts — Carga: 100 reservas concurrentes. QA-06 (#309).
//
// Dos escenarios:
//   A) THROUGHPUT/INTEGRIDAD — N reservas concurrentes, cada una en su propia habitación y fechas
//      lejanas. Verifica que no hay 500/crash, que las N se persisten y mide latencia p50/p95/max.
//   B) RACE — R reservas concurrentes sobre la MISMA habitación y MISMAS fechas. Sólo 1 debe
//      ganar (201); el resto debe chocar (409 "no disponible"). Si gana más de una → doble-booking
//      por TOCTOU en `assertRoomAvailable` (findMany→check sin lock). Se REPORTA (no aborta la suite).
//
// El setup (huésped + N habitaciones) se siembra DIRECTO por bun:sqlite, no por API: la app tiene
// un rate-limit GLOBAL de 200 req/min/IP (composition-root.ts) y crear las habitaciones por HTTP
// consumiría el presupuesto que necesitamos para las reservas concurrentes bajo prueba. Las 429 se
// clasifican aparte (backpressure), no como crash.
//
//   PORT=3001 bun run src/composition-root.ts        (en otra terminal)
//   bun run scripts/e2e/load-reservations.e2e.ts
//
// Env: BASE_URL, DB_PATH, E2E_EMAIL, E2E_PASSWORD, N (default 100), RACE (default 15).

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'
const N = Number(process.env.N ?? 100)
const RACE = Number(process.env.RACE ?? 15)

const stamp = Date.now()
const tag = `LOAD${String(stamp).slice(-8)}`
const created: { rooms: string[]; guests: string[]; reservations: string[] } = { rooms: [], guests: [], reservations: [] }

const db = new Database(DB_PATH)
const cleanup = () => {
  for (const id of created.reservations) {
    db.run('DELETE FROM folios WHERE reservationId=?', [id])
    db.run('DELETE FROM reservations WHERE id=?', [id])
  }
  // Barrido por si alguna reserva se creó pero no volvió su id (timeout de red): borra por habitación.
  for (const id of created.rooms) db.run('DELETE FROM reservations WHERE roomId=?', [id])
  for (const id of created.rooms) db.run('DELETE FROM rooms WHERE id=?', [id])
  for (const id of created.guests) db.run('DELETE FROM guests WHERE id=?', [id])
  db.close()
}

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

let token = ''
const api = async (method: string, path: string, body?: any) => {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, data: (j as any)?.data ?? j, ms: performance.now() - t0 }
}

const d = (n: number) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

let failed = false
try {
  // ── Login ──
  const login = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })
  token = login.data?.token
  const hotelId = login.data?.user?.hotelId
  if (!token || !hotelId) { console.error('❌ login falló'); process.exit(1) }
  console.log(`Login OK · hotelId=${hotelId}\n`)

  // ── Setup: 1 huésped + N habitaciones (siembra DIRECTA por DB, no consume el budget HTTP) ──
  const now = new Date().toISOString()
  const guestId = crypto.randomUUID()
  db.run(
    'INSERT INTO guests (id, name, email, hotelId, tier, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)',
    [guestId, `${tag} Guest`, `${tag.toLowerCase()}@load.test`, hotelId, 'bronze', 1, now, now],
  )
  created.guests.push(guestId)

  console.log(`Sembrando ${N} habitaciones…`)
  const insRoom = db.prepare(
    'INSERT INTO rooms (id, number, type, basePrice, status, hotelId, capacity, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
  )
  db.transaction(() => {
    for (let i = 0; i < N; i++) {
      const id = crypto.randomUUID()
      insRoom.run(id, `${tag}-${i}`, 'single', 100, 'available', hotelId, 2, now, now)
      created.rooms.push(id)
    }
  })()
  if (created.rooms.length < N) { console.error(`❌ sólo se sembraron ${created.rooms.length}/${N} habitaciones`); process.exit(1) }

  // ── Escenario A: N reservas concurrentes, una por habitación ──
  console.log(`\n— A. ${N} reservas concurrentes (una por habitación) —`)
  const checkIn = d(200), checkOut = d(202)
  const t0 = performance.now()
  const resA = await Promise.all(
    created.rooms.map((roomId) =>
      api('POST', '/api/reservas', { hotelId, roomId, guestId, checkIn, checkOut, totalAmount: 200, status: 'confirmed', channel: 'direct' }),
    ),
  )
  const wallA = performance.now() - t0
  for (const r of resA) if (r.data?.id) created.reservations.push(r.data.id)

  const byStatus: Record<number, number> = {}
  const times: number[] = []
  for (const r of resA) { byStatus[r.status] = (byStatus[r.status] || 0) + 1; times.push(r.ms) }
  times.sort((a, b) => a - b)
  const ok201 = (byStatus[201] || 0) + (byStatus[200] || 0)
  const throttled = byStatus[429] || 0
  const crashes = Object.entries(byStatus).filter(([s]) => Number(s) >= 500).reduce((a, [, c]) => a + c, 0)

  // Verificación de integridad: cuántas reservas quedaron realmente en la BD para estas habitaciones.
  const placeholders = created.rooms.map(() => '?').join(',')
  const persisted = (db.query(`SELECT COUNT(*) c FROM reservations WHERE roomId IN (${placeholders})`).get(...created.rooms) as any).c

  console.log(`  distribución de status: ${JSON.stringify(byStatus)}`)
  console.log(`  latencia  p50=${percentile(times, 50).toFixed(0)}ms  p95=${percentile(times, 95).toFixed(0)}ms  max=${times[times.length - 1].toFixed(0)}ms`)
  console.log(`  wall-clock total: ${wallA.toFixed(0)}ms  ·  throughput ≈ ${(N / (wallA / 1000)).toFixed(1)} req/s`)
  console.log(`  ${ok201 === N ? '✅' : (crashes === 0 ? '⚠️ ' : '❌')} ${ok201}/${N} creadas (2xx)` + (throttled ? `  ·  ${throttled} throttled (429, rate-limit global 200/min)` : ''))
  console.log(`  ${persisted === ok201 ? '✅' : '❌'} ${persisted} persistidas en BD == ${ok201} respuestas 2xx (integridad: sin fantasmas ni pérdidas)`)
  console.log(`  ${crashes === 0 ? '✅' : '❌'} ${crashes} respuestas 5xx (crash/deadlock)`)
  // Falla sólo por 5xx o por descuadre 2xx↔BD. Las 429 son backpressure legítimo del rate-limit.
  if (crashes !== 0 || persisted !== ok201) failed = true
  if (throttled > 0) console.log(`  ℹ️  ${throttled} reservas fueron limitadas por el rate-limit global (200 req/min/IP): subir el tope o whitelistear la IP interna para picos de front-desk.`)

  // ── Escenario B: race sobre la MISMA habitación + fechas ──
  console.log(`\n— B. ${RACE} reservas concurrentes sobre la MISMA habitación/fechas (race) —`)
  const raceRoom = created.rooms[0]
  const raceIn = d(400), raceOut = d(402)
  const resB = await Promise.all(
    Array.from({ length: RACE }, () =>
      api('POST', '/api/reservas', { hotelId, roomId: raceRoom, guestId, checkIn: raceIn, checkOut: raceOut, totalAmount: 200, status: 'confirmed', channel: 'direct' }),
    ),
  )
  for (const r of resB) if (r.data?.id) created.reservations.push(r.data.id)
  const won = resB.filter((r) => r.status === 201 || r.status === 200).length
  const conflicts = resB.filter((r) => r.status === 409).length
  // Fuente de verdad: cuántas reservas activas se solapan realmente en esa habitación/fechas.
  const overlap = (db.query(
    `SELECT COUNT(*) c FROM reservations WHERE roomId=? AND status NOT IN ('cancelled','no_show') AND checkIn < ? AND checkOut > ?`,
  ).get(raceRoom, raceOut, raceIn) as any).c
  console.log(`  ganadas(2xx)=${won}  conflictos(409)=${conflicts}  otros=${RACE - won - conflicts}`)
  console.log(`  reservas solapadas reales en BD: ${overlap}`)
  if (overlap <= 1) {
    console.log('  ✅ sin doble-booking: el guard de disponibilidad aguanta la concurrencia')
  } else {
    console.log(`  🐛 DOBLE-BOOKING: ${overlap} reservas activas solapadas → TOCTOU en assertRoomAvailable (read-then-write sin lock)`)
    console.log('     Fix: constraint/índice único de solapamiento o SELECT … FOR UPDATE / transacción en el create.')
    failed = true
  }
} catch (e) {
  failed = true
  console.error('  ❌ excepción:', e)
} finally {
  cleanup()
}

console.log(`\n${'═'.repeat(60)}\n  ${failed ? '❌ con hallazgos' : '✅ carga OK'} — limpieza hecha`)
process.exit(failed ? 1 : 0)
