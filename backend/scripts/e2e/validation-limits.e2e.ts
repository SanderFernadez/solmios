// scripts/e2e/validation-limits.e2e.ts — Prueba que los límites son REALES (backend, no frontend).
//
// Le pega DIRECTO a la API (saltea cualquier maxLength del navegador) con strings/números fuera de
// rango y espera 400. Esto demuestra que la validación protege la DB, no solo la UI.
//
//   bun run scripts/e2e/validation-limits.e2e.ts
export {}

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }
const BIG = 'x'.repeat(5000)   // string gigante que ningún maxLength de UI frenaría

async function api(method: string, path: string, token: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return res.status
}

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')
  // employeeId real para los que lo exigen
  const list = await (await fetch(`${BASE}/api/employee-profiles`, { headers: { Authorization: `Bearer ${token}` } })).json() as any
  const rows = list?.data?.data ?? list?.data ?? []
  const emp = rows[0]?.id
  ok(!!emp, 'hay un empleado para las pruebas')

  console.log('\n— Texto gigante por API directa → 400 —')
  ok(await api('POST', '/api/departments', token, { name: 'X', description: BIG }) === 400, 'departamento: description 5000 → 400')
  ok(await api('POST', '/api/performance-reviews', token, { employeeId: emp, reviewerId: emp, reviewDate: '2026-01-01', strengths: BIG }) === 400, 'evaluación: strengths 5000 → 400')
  ok(await api('POST', '/api/employee-documents', token, { employeeId: emp, type: 'other', name: BIG }) === 400, 'documento: name 5000 → 400')
  ok(await api('POST', '/api/expense-claims', token, { employeeId: emp, description: BIG, amount: 100, date: '2026-01-01' }) === 400, 'reembolso: description 5000 → 400')
  ok(await api('POST', '/api/applicants', token, { name: BIG }) === 400, 'postulante: name 5000 → 400')

  console.log('\n— Números fuera de rango por API directa → 400 —')
  ok(await api('POST', '/api/expense-claims', token, { employeeId: emp, description: 'x', amount: 999999999999, date: '2026-01-01' }) === 400, 'reembolso: monto gigante → 400')
  ok(await api('POST', '/api/performance-reviews', token, { employeeId: emp, reviewerId: emp, reviewDate: '2026-01-01', score: 99 }) === 400, 'evaluación: score 99 → 400')

  console.log('\n— Contra-prueba: un valor válido SÍ pasa —')
  const okName = 'QA-lim-' + rows.length
  const created = await fetch(`${BASE}/api/applicants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: okName }),
  })
  ok(created.status === 201, 'postulante con nombre normal → 201')
  const cid = ((await created.json()) as any)?.data?.id
  if (cid) await fetch(`${BASE}/api/applicants/${cid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
