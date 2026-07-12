// scripts/e2e/employee-validations.e2e.ts — Barrido de validaciones de Empleados.
//
// Verifica los fixes con backend: #172 (rol en el listado) y #181 (nombre de documento único).
//
//   bun run scripts/e2e/employee-validations.e2e.ts
export {}

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null) as any
  return { status: res.status, data: json?.data ?? json }
}
const rows = (r: any) => (r.data?.data ?? r.data) as any[]

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')

  // ── #172: el listado trae userRole ──
  console.log('\n— #172 Rol en el listado —')
  const list = rows(await api('GET', '/api/employee-profiles', token))
  ok(list.length >= 1, `hay empleados (${list.length})`)
  ok(list.every((p) => 'userRole' in p), 'cada empleado trae el campo userRole')
  ok(list.some((p) => !!p.userRole), 'al menos un empleado tiene rol resuelto')
  const emp = list[0]

  // ── #181: nombre de documento único ──
  console.log('\n— #181 Nombre de documento único —')
  const uniqueName = 'E2E-doc-' + Math.abs([...('' + emp.id)].reduce((a, c) => a + c.charCodeAt(0), 0))
  const first = await api('POST', '/api/employee-documents', token, {
    employeeId: emp.id, type: 'other', name: uniqueName,
  })
  ok(first.status === 201, `primer documento → 201 (${first.status})`)
  const dup = await api('POST', '/api/employee-documents', token, {
    employeeId: emp.id, type: 'other', name: uniqueName,
  })
  ok(dup.status === 409, `documento con mismo nombre → 409 (${dup.status})`)
  const dupCase = await api('POST', '/api/employee-documents', token, {
    employeeId: emp.id, type: 'other', name: uniqueName.toUpperCase(),
  })
  ok(dupCase.status === 409, `mismo nombre en MAYÚSCULAS → 409 (case-insensitive) (${dupCase.status})`)

  // cleanup
  if (first.data?.id) await api('DELETE', `/api/employee-documents/${first.data.id}`, token)
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
