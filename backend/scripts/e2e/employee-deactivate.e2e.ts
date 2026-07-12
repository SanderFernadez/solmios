// scripts/e2e/employee-deactivate.e2e.ts — E2E del flujo desactivar/reactivar empleado (#174).
//
// Verifica que "desactivar" es un SOFT-deactivate reversible (no borra): el legajo desaparece del
// listado activo pero sigue existiendo (aparece con includeInactive) y se puede reactivar.
//
//   bun run scripts/e2e/employee-deactivate.e2e.ts
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
const listActive = (r: any) => (r.data?.data ?? r.data) as any[]

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')

  // Tomamos un empleado activo
  const before = await api('GET', '/api/employee-profiles', token)
  const active = listActive(before)
  ok(active.length >= 1, `hay empleados activos (${active.length})`)
  const target = active[0]

  // ── Desactivar ──
  console.log('\n— Desactivar (soft) —')
  const deact = await api('DELETE', `/api/employee-profiles/${target.id}`, token)
  ok(deact.status === 204, `DELETE → 204 (${deact.status})`)

  const activeAfter = listActive(await api('GET', '/api/employee-profiles', token))
  ok(!activeAfter.some((p) => p.id === target.id), 'desaparece del listado ACTIVO')

  // ── NO se borró: aparece con includeInactive ──
  console.log('\n— No se borró: sigue existiendo —')
  const withInactive = listActive(await api('GET', '/api/employee-profiles?includeInactive=true', token))
  const found = withInactive.find((p) => p.id === target.id)
  ok(!!found, 'sigue existiendo (aparece con includeInactive)')
  ok(found && Number(found.active) === 0, 'su estado es active=0 (inactivo, no borrado)')
  // La cuenta de usuario sigue: getById del perfil responde 200
  const stillThere = await api('GET', `/api/employee-profiles/${target.id}`, token)
  ok(stillThere.status === 200, 'el legajo sigue accesible por id (200)')

  // ── Reactivar ──
  console.log('\n— Reactivar —')
  const react = await api('POST', `/api/employee-profiles/${target.id}/reactivate`, token, {})
  ok(react.status === 200 && Number(react.data?.active) === 1, 'reactivar → 200, active=1')
  const activeFinal = listActive(await api('GET', '/api/employee-profiles', token))
  ok(activeFinal.some((p) => p.id === target.id), 'vuelve a aparecer en el listado activo')
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
