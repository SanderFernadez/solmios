// scripts/e2e/org-chart.e2e.ts — E2E del organigrama (Ola 7, #199).
//
// Verifica que /api/org-chart devuelve el árbol jerárquico con nombres de empleado resueltos
// y el anidamiento padre→hijo por departments.parentId.
//
//   bun run scripts/e2e/org-chart.e2e.ts
export {}

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

interface Node { id: string; name: string; employees: { userName?: string; position?: string }[]; children: Node[] }

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')

  const res = await fetch(`${BASE}/api/org-chart`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json() as any
  const chart = body?.data ?? body
  ok(res.status === 200, 'GET /api/org-chart → 200')
  ok(Array.isArray(chart.departments), 'devuelve departments[]')
  ok(typeof chart.totalEmployees === 'number', 'devuelve totalEmployees')

  const flatten = (nodes: Node[]): Node[] => nodes.flatMap((n) => [n, ...flatten(n.children)])
  const all = flatten(chart.departments)
  ok(all.length >= 1, `hay al menos un departamento (${all.length})`)

  const withChildren = all.find((n) => n.children.length > 0)
  ok(!!withChildren, 'al menos un departamento tiene hijos (jerarquía real)')

  const employees = all.flatMap((n) => n.employees)
  ok(employees.length >= 1, `hay empleados en el árbol (${employees.length})`)
  const named = employees.some((e) => e.userName && e.userName.length > 0)
  ok(named, 'al menos un empleado trae el NOMBRE resuelto (no solo el cargo)')
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
