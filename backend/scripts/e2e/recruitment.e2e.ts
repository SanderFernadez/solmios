// scripts/e2e/recruitment.e2e.ts — E2E del módulo de reclutamiento (Ola 5, Odoo hr_recruitment).
//
// Verifica: alta de postulante (nace en 'new'), pipeline por etapas, avance de etapa, rechazo con
// motivo obligatorio, contratación (candidato→empleado) e inmutabilidad post-contratación.
//
//   bun run scripts/e2e/recruitment.e2e.ts

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

const db = new Database(DB_PATH)
const createdIds: string[] = []

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

  // ── Alta de postulante ──
  console.log('\n— Alta de postulante —')
  const created = await api('POST', '/api/applicants', token, { name: 'Ana Rodríguez', email: 'ana@mail.com', source: 'web' })
  ok(created.status === 201, 'POST /api/applicants → 201')
  createdIds.push(created.data?.id)
  ok(created.data?.stage === 'new', `nace en etapa 'new' (${created.data?.stage})`)

  const list = await api('GET', '/api/applicants', token)
  ok(list.status === 200 && list.data.some((a: any) => a.id === created.data.id), 'aparece en el listado')

  // ── Pipeline ──
  console.log('\n— Pipeline por etapas —')
  const pipe = await api('GET', '/api/applicants/pipeline', token)
  ok(pipe.status === 200 && Array.isArray(pipe.data), 'GET /api/applicants/pipeline → 200 array')
  ok(pipe.data.length === 6, `6 etapas en el pipeline (${pipe.data.length})`)
  const newStage = pipe.data.find((s: any) => s.stage === 'new')
  ok(newStage && newStage.count >= 1, "la etapa 'new' cuenta al postulante")

  // ── Avance de etapa ──
  console.log('\n— Avanzar de etapa —')
  const moved = await api('POST', `/api/applicants/${created.data.id}/stage`, token, { stage: 'interview' })
  ok(moved.status === 200 && moved.data?.stage === 'interview', "movido a 'interview'")
  const badStage = await api('POST', `/api/applicants/${created.data.id}/stage`, token, { stage: 'inexistente' })
  ok(badStage.status === 400, `etapa inválida → 400 (${badStage.status})`)

  // ── Rechazo requiere motivo ──
  console.log('\n— Rechazo con motivo obligatorio —')
  const rejNoReason = await api('POST', `/api/applicants/${created.data.id}/reject`, token, {})
  ok(rejNoReason.status === 400, `rechazo sin motivo → 400 (${rejNoReason.status})`)

  // ── Contratar (candidato → empleado) ──
  console.log('\n— Contratación —')
  const profile = db.query('SELECT id FROM employee_profiles WHERE active=1 LIMIT 1').get() as any
  const hired = await api('POST', `/api/applicants/${created.data.id}/hire`, token, { hiredEmployeeId: profile?.id })
  ok(hired.status === 200 && hired.data?.stage === 'hired', "contratado → etapa 'hired'")
  ok(hired.data?.hiredEmployeeId === profile?.id, 'guardó hiredEmployeeId (liga al expediente)')

  const reHire = await api('POST', `/api/applicants/${created.data.id}/hire`, token, {})
  ok(reHire.status === 400, `recontratar → 400 (ya contratado) (${reHire.status})`)
} finally {
  for (const id of createdIds) if (id) db.run('DELETE FROM job_applicants WHERE id=?', [id])
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
