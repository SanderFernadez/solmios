// scripts/e2e/reimbursement-caja.e2e.ts — Conexión reembolsos → gastos → caja.
//
// Paga un reembolso EN EFECTIVO y verifica que quedó asentado como gasto del hotel (source=reimbursement).
// Desde gastos, gastos-caja lo lleva al arqueo. Prueba que la plata NO queda en un silo.
//
//   bun run scripts/e2e/reimbursement-caja.e2e.ts
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
const rows = (r: any) => (r.data?.data ?? r.data ?? []) as any[]

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')
  const emp = rows(await api('GET', '/api/employee-profiles', token))[0]?.id
  ok(!!emp, 'hay un empleado')

  // Flujo: crear → enviar → aprobar → pagar EN EFECTIVO
  console.log('\n— Reembolso pagado en efectivo —')
  const amount = 777
  const created = await api('POST', '/api/expense-claims', token, { employeeId: emp, description: `Conexion caja ${Date.now() % 100000}`, amount, date: '2026-07-01' })
  const id = created.data?.id
  ok(created.status === 201 && !!id, 'reembolso creado')
  await api('POST', `/api/expense-claims/${id}/submit`, token, {})
  await api('POST', `/api/expense-claims/${id}/approve`, token, {})
  const paid = await api('POST', `/api/expense-claims/${id}/pay`, token, { paymentMethod: 'cash' })
  ok(paid.status === 200 && paid.data?.status === 'paid', 'pagado en efectivo → paid')

  // El connector es best-effort/async: esperar un tick
  await new Promise((r) => setTimeout(r, 400))

  // Verificar que quedó asentado como gasto
  console.log('\n— Asentado como gasto (→ caja) —')
  const gastos = rows(await api('GET', '/api/gastos', token))
  const g = gastos.find((x) => x.source === 'reimbursement' && x.sourceId === id)
  ok(!!g, 'existe un gasto con source=reimbursement ligado al reembolso')
  ok(g && Number(g.amount) === amount, `el gasto tiene el monto correcto (${g?.amount})`)
  ok(g && g.paymentMethod === 'cash', 'el gasto quedó como efectivo (→ mueve la caja)')

  // cleanup: borrar el gasto derivado y el reembolso queda pagado (no se borra por regla)
  if (g?.id) await api('DELETE', `/api/gastos/${g.id}`, token)
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
