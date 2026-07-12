// scripts/e2e/hr-catalog.e2e.ts — E2E de campos Empleado/Contrato a nivel Odoo (Ola 4).
//
// Verifica: puestos (job positions), tipos de contrato configurables (seed), ubicaciones, campos
// personales extendidos del perfil (nacionalidad/estado civil/...), y validación de fecha de contrato (#177).
//
//   bun run scripts/e2e/hr-catalog.e2e.ts
//
// Idempotente: borra lo que crea (los tipos de contrato por defecto quedan como config).

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
const { id: profileId, hotelId } = prof
const createdJobIds: string[] = [], createdLocIds: string[] = []
let touchedProfile = false

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null) as any
  return { status: res.status, data: json?.data ?? json }
}

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')

  // ── Job Positions ──
  console.log('\n— Puestos (job positions) —')
  const job = await api('POST', '/api/job-positions', token, { name: 'Recepcionista nocturno', expectedEmployees: 2 })
  ok(job.status === 201, 'POST /api/job-positions → 201')
  createdJobIds.push(job.data?.id)
  ok(job.data?.expectedEmployees === 2, `expectedEmployees === 2 (${job.data?.expectedEmployees})`)
  const jobs = await api('GET', '/api/job-positions', token)
  ok(jobs.status === 200 && jobs.data.some((j: any) => j.id === job.data.id), 'el puesto aparece en el listado')

  // ── Contract Types (seed) ──
  console.log('\n— Tipos de contrato (config) —')
  const cts = await api('GET', '/api/contract-types', token)
  ok(cts.status === 200 && Array.isArray(cts.data), 'GET /api/contract-types → 200 array')
  ok(cts.data.length >= 5, `sembró ≥5 tipos por defecto (${cts.data.length})`)
  ok(cts.data.some((t: any) => t.code === 'full_time'), 'incluye full_time')

  // ── Work Locations ──
  console.log('\n— Ubicaciones de trabajo —')
  const loc = await api('POST', '/api/work-locations', token, { name: 'Lobby principal', address: 'Planta baja' })
  ok(loc.status === 201, 'POST /api/work-locations → 201')
  createdLocIds.push(loc.data?.id)

  // ── Campos personales extendidos del perfil ──
  console.log('\n— Perfil: datos personales extendidos —')
  touchedProfile = true
  const upd = await api('PUT', `/api/employee-profiles/${profileId}`, token, {
    nationality: 'Dominicana', maritalStatus: 'married', gender: 'male', education: 'Universitario',
    jobPositionId: job.data.id,
  })
  ok(upd.status === 200, 'PUT /api/employee-profiles/:id → 200')
  ok(upd.data?.nationality === 'Dominicana', `nacionalidad persistida (${upd.data?.nationality})`)
  ok(upd.data?.maritalStatus === 'married', 'estado civil persistido')
  ok(upd.data?.jobPositionId === job.data.id, 'jobPositionId persistido')

  // ── #177 Fecha de contrato ──
  console.log('\n— #177 Validación de fecha de contrato —')
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const badStart = await api('POST', '/api/employee-contracts', token, {
    employeeId: profileId, type: 'full_time', startDate: future, salary: 1500,
  })
  ok(badStart.status === 400, `fecha de inicio futura → 400 (${badStart.status})`)

  const badRange = await api('POST', '/api/employee-contracts', token, {
    employeeId: profileId, type: 'full_time', startDate: '2026-06-01', endDate: '2026-05-01', salary: 1500,
  })
  ok(badRange.status === 400, `fin anterior al inicio → 400 (${badRange.status})`)
} finally {
  for (const id of createdJobIds) if (id) db.run('DELETE FROM job_positions WHERE id=?', [id])
  for (const id of createdLocIds) if (id) db.run('DELETE FROM work_locations WHERE id=?', [id])
  if (touchedProfile) db.run('UPDATE employee_profiles SET nationality=NULL, maritalStatus=NULL, gender=NULL, education=NULL, jobPositionId=NULL WHERE id=?', [profileId])
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
