// scripts/e2e/hr-dashboard.e2e.ts — E2E del endpoint /api/hr-dashboard (Ola 1: widgets Odoo + pedidos).
//
// Verifica el JSON de respuesta contra lo esperado para CADA widget nuevo. Asume backend corriendo
// (BASE_URL, def http://localhost:3000) y la DB de dev con el seed base.
//
//   bun run scripts/e2e/hr-dashboard.e2e.ts
//
// Siembra sus propios datos (cumpleaños de este mes, licencia que cubre hoy, evaluación completada)
// para poder aseverar valores concretos, y es idempotente (borra su rastro al terminar).

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (cond: boolean, msg: string) => { cond ? (pass++, console.log(`  ✅ ${msg}`)) : (fail++, console.error(`  ❌ ${msg}`)) }

// ── Seed determinístico ───────────────────────────────────────────────
const db = new Database(DB_PATH)
const now = new Date(), iso = now.toISOString(), today = iso.slice(0, 10), ym = iso.slice(0, 7)
const bday = `${ym}-15`
const leaveStart = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
const leaveEnd = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10)

const hotelId = (db.query('SELECT hotelId FROM employee_profiles LIMIT 1').get() as any)?.hotelId
if (!hotelId) { console.error('Sin employee_profiles seed — corré `bun run migrate` primero'); process.exit(1) }
const profiles = db.query('SELECT id FROM employee_profiles WHERE hotelId=? AND active=1 LIMIT 3').all(hotelId) as { id: string }[]
if (profiles.length < 2) { console.error('Se necesitan ≥2 perfiles activos'); process.exit(1) }
const [pA, pB] = profiles
const leaveId = crypto.randomUUID(), reviewId = crypto.randomUUID()

db.run('UPDATE employee_profiles SET birthDate=? WHERE id=?', [bday, pA.id])
db.run('INSERT INTO leave_requests (id,hotelId,employeeId,type,startDate,endDate,days,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
  [leaveId, hotelId, pB.id, 'vacation', leaveStart, leaveEnd, 4, 'approved', iso, iso])
db.run('INSERT INTO performance_reviews (id,hotelId,employeeId,reviewerId,reviewDate,score,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
  [reviewId, hotelId, pA.id, pB.id, today, 8, 'completed', iso, iso])

function cleanup() {
  db.run('DELETE FROM leave_requests WHERE id=?', [leaveId])
  db.run('DELETE FROM performance_reviews WHERE id=?', [reviewId])
  db.run('UPDATE employee_profiles SET birthDate=NULL WHERE id=?', [pA.id])
}

try {
  // ── Login ───────────────────────────────────────────────────────────
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const loginBody = await loginRes.json() as any
  const token = loginBody?.data?.token ?? loginBody?.token
  ok(loginRes.status === 200 && !!token, `login ${EMAIL} → 200 + token`)

  // ── GET /api/hr-dashboard ───────────────────────────────────────────
  const res = await fetch(`${BASE}/api/hr-dashboard`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json() as any
  const d = body?.data ?? body
  ok(res.status === 200, 'GET /api/hr-dashboard → 200')

  console.log('\n— Shape base (regresión) —')
  ok(typeof d.headcount === 'number' && d.headcount >= 2, `headcount es número (${d.headcount})`)
  ok(Array.isArray(d.byDepartment), 'byDepartment es array')
  ok(typeof d.contracts?.active === 'number', 'contracts.active presente')

  console.log('\n— #196 Cumpleaños del mes —')
  ok(Array.isArray(d.birthdaysThisMonth), 'birthdaysThisMonth es array')
  const bd = d.birthdaysThisMonth.find((b: any) => b.employeeId === pA.id)
  ok(!!bd, 'incluye al empleado con cumpleaños sembrado')
  ok(bd?.day === 15, `day === 15 (${bd?.day})`)
  ok(bd?.date === bday, `date === ${bday}`)
  ok(typeof bd?.name === 'string' && bd.name.length > 0, `name resuelto ("${bd?.name}")`)

  console.log('\n— #197 De licencia hoy —')
  ok(Array.isArray(d.onLeaveToday), 'onLeaveToday es array')
  const ol = d.onLeaveToday.find((l: any) => l.employeeId === pB.id)
  ok(!!ol, 'incluye la licencia aprobada que cubre hoy')
  ok(ol?.type === 'vacation', `type === vacation (${ol?.type})`)
  ok(ol?.startDate <= today && ol?.endDate >= today, 'rango cubre hoy')

  console.log('\n— #202 Top desempeño —')
  ok(Array.isArray(d.topPerformers), 'topPerformers es array')
  const tp = d.topPerformers.find((t: any) => t.employeeId === pA.id)
  ok(!!tp, 'incluye al empleado evaluado')
  ok(tp?.avgScore === 8, `avgScore === 8 (${tp?.avgScore})`)
  ok(tp?.reviews === 1, `reviews === 1 (${tp?.reviews})`)

  console.log('\n— #200 Ocupación (3 estados) —')
  ok(typeof d.occupancy?.total === 'number', 'occupancy.total presente')
  ok(d.occupancy.available + d.occupancy.onLeave === d.headcount, `available+onLeave === headcount (${d.occupancy.available}+${d.occupancy.onLeave})`)
  ok(d.occupancy.onLeave >= 1, `onLeave ≥ 1 (${d.occupancy.onLeave})`)
  ok(d.occupancy.total === d.occupancy.available + d.occupancy.onLeave + d.occupancy.inactive, 'total === suma de estados')

  console.log('\n— #205 Pendientes consolidados —')
  ok(d.pending && typeof d.pending.leavesPending === 'number', 'pending.leavesPending presente')
  ok(typeof d.pending.contractsExpiring === 'number', 'pending.contractsExpiring presente')
  ok(typeof d.pending.documentsExpiring === 'number', 'pending.documentsExpiring presente')
  ok(typeof d.pending.reviewsPending === 'number', 'pending.reviewsPending presente')
} finally {
  cleanup()
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
