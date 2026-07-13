// scripts/e2e/dashboard-attendance.e2e.ts — Conexión attendance → dashboard (#198).
//
// Siembra un fichaje de HOY y verifica que /api/hr-dashboard trae el resumen de asistencia real
// (presentes/ausentes/tarde), no null. Prueba que el connector attendance-dashboard funciona.
//
//   bun run scripts/e2e/dashboard-attendance.e2e.ts

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

const db = new Database(DB_PATH)
const prof = db.query('SELECT id, hotelId FROM employee_profiles WHERE active=1 LIMIT 1').get() as any
if (!prof) { console.error('Falta seed de empleados'); process.exit(1) }
const { id: employeeId, hotelId } = prof
const now = new Date(), iso = now.toISOString(), today = iso.slice(0, 10)
const recordId = crypto.randomUUID()

// Fichaje de hoy (presente)
db.run('INSERT INTO attendance_records (id,hotelId,employeeId,date,clockIn,status,method,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
  [recordId, hotelId, employeeId, today, iso, 'present', 'pin', iso, iso])

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')

  const res = await fetch(`${BASE}/api/hr-dashboard`, { headers: { Authorization: `Bearer ${token}` } })
  const body = (await res.json()) as any
  const d = body?.data ?? body
  ok(res.status === 200, 'GET /api/hr-dashboard → 200')

  console.log('\n— #198 Resumen de asistencia en el dashboard —')
  ok(d.attendance !== null && typeof d.attendance === 'object', 'el dashboard trae attendance (connector activo)')
  ok(d.attendance?.present >= 1, `presentes ≥ 1 (fichaje sembrado) → ${d.attendance?.present}`)
  ok(typeof d.attendance?.absent === 'number', `ausentes es número → ${d.attendance?.absent}`)
  ok(d.attendance.present + d.attendance.absent === d.headcount, `presentes + ausentes === headcount (${d.attendance.present}+${d.attendance.absent}=${d.headcount})`)
  ok(typeof d.attendance?.late === 'number', 'tarde es número')
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
} finally {
  db.run('DELETE FROM attendance_records WHERE id=?', [recordId])
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
