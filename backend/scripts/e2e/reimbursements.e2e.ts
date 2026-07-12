// scripts/e2e/reimbursements.e2e.ts — E2E de reembolsos de empleado (Ola 6, Odoo hr_expense).
//
// Verifica el flujo completo: crear (draft) → enviar → aprobar → pagar, con las transiciones de
// estado protegidas, rechazo con motivo obligatorio, y totales por estado.
//
//   bun run scripts/e2e/reimbursements.e2e.ts

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
const { id: employeeId } = prof
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

  // ── Crear (draft) ──
  console.log('\n— Crear reembolso —')
  const created = await api('POST', '/api/expense-claims', token, {
    employeeId, category: 'transporte', description: 'Taxi al aeropuerto', amount: 850, date: '2026-07-01',
  })
  ok(created.status === 201, 'POST /api/expense-claims → 201')
  createdIds.push(created.data?.id)
  ok(created.data?.status === 'draft', `nace en 'draft' (${created.data?.status})`)
  const id = created.data.id

  // ── No se puede aprobar en draft ──
  console.log('\n— Transiciones protegidas —')
  const earlyApprove = await api('POST', `/api/expense-claims/${id}/approve`, token, {})
  ok(earlyApprove.status === 400, `aprobar en draft → 400 (${earlyApprove.status})`)

  // ── Enviar → aprobar → pagar ──
  console.log('\n— Flujo submit → approve → pay —')
  const submitted = await api('POST', `/api/expense-claims/${id}/submit`, token, {})
  ok(submitted.status === 200 && submitted.data?.status === 'submitted', "enviado → 'submitted'")
  const approved = await api('POST', `/api/expense-claims/${id}/approve`, token, {})
  ok(approved.status === 200 && approved.data?.status === 'approved', "aprobado → 'approved'")
  ok(!!approved.data?.approvedAt, 'registró approvedAt')

  const badPay = await api('POST', `/api/expense-claims/${id}/pay`, token, {})
  ok(badPay.status === 400, `pagar sin método → 400 (${badPay.status})`)
  const paid = await api('POST', `/api/expense-claims/${id}/pay`, token, { paymentMethod: 'cash' })
  ok(paid.status === 200 && paid.data?.status === 'paid', "pagado → 'paid'")
  ok(paid.data?.paymentMethod === 'cash' && !!paid.data?.paidAt, 'registró método y fecha de pago')

  // ── Un pagado no se elimina ──
  const delPaid = await api('DELETE', `/api/expense-claims/${id}`, token)
  ok(delPaid.status === 400, `eliminar pagado → 400 (${delPaid.status})`)

  // ── Rechazo con motivo ──
  console.log('\n— Rechazo con motivo obligatorio —')
  const c2 = await api('POST', '/api/expense-claims', token, { employeeId, description: 'Almuerzo', amount: 400, date: '2026-07-02' })
  createdIds.push(c2.data?.id)
  await api('POST', `/api/expense-claims/${c2.data.id}/submit`, token, {})
  const rejNo = await api('POST', `/api/expense-claims/${c2.data.id}/reject`, token, {})
  ok(rejNo.status === 400, `rechazo sin motivo → 400 (${rejNo.status})`)
  const rejOk = await api('POST', `/api/expense-claims/${c2.data.id}/reject`, token, { reason: 'Fuera de política' })
  ok(rejOk.status === 200 && rejOk.data?.status === 'rejected', 'rechazo con motivo → 200 rejected')

  // ── Totales por estado ──
  console.log('\n— Totales por estado —')
  const totals = await api('GET', '/api/expense-claims/totals', token)
  ok(totals.status === 200 && totals.data?.paid?.amount >= 850, `totals.paid incluye el reembolso pagado (${totals.data?.paid?.amount})`)
} finally {
  for (const id of createdIds) if (id) db.run('DELETE FROM expense_claims WHERE id=?', [id])
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
