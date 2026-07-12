// scripts/e2e/time-off.e2e.ts — E2E de Time Off a nivel Odoo (Ola 2).
//
// Verifica el JSON de: tipos configurables (defaults sembrados), cálculo automático de días
// descontando festivos (#188), asignaciones + saldo por tipo, calendario, y motivo de rechazo
// obligatorio (#190/#191). Asume backend corriendo (BASE_URL) + DB dev con seed base.
//
//   bun run scripts/e2e/time-off.e2e.ts
//
// Es idempotente: borra las licencias/festivo/asignación que crea. Los tipos por defecto quedan
// (son configuración real del hotel, se siembran una sola vez).

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

const db = new Database(DB_PATH)
const hotelId = (db.query('SELECT hotelId FROM employee_profiles LIMIT 1').get() as any)?.hotelId
const employeeId = (db.query('SELECT id FROM employee_profiles WHERE hotelId=? AND active=1 LIMIT 1').get(hotelId) as any)?.id
if (!hotelId || !employeeId) { console.error('Falta seed de empleados — corré `bun run migrate`'); process.exit(1) }

const year = new Date().getFullYear()
const start = `${year}-08-10`, end = `${year}-08-14`, holidayDate = `${year}-08-12`
const createdLeaveIds: string[] = []
let holidayId = '', allocationId = ''

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null) as any
  return { status: res.status, data: json?.data ?? json, raw: json }
}

try {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = ((await loginRes.json()) as any)?.data?.token
  ok(loginRes.status === 200 && !!token, 'login → 200 + token')

  // ── #187/#189 Tipos configurables (defaults sembrados) ──
  console.log('\n— Tipos de ausencia (config) —')
  const types = await api('GET', '/api/leave-types', token)
  ok(types.status === 200 && Array.isArray(types.data), 'GET /api/leave-types → 200 array')
  ok(types.data.length >= 5, `sembró ≥5 tipos por defecto (${types.data.length})`)
  const vacation = types.data.find((t: any) => t.code === 'vacation')
  ok(!!vacation && vacation.name === 'Vacaciones', 'incluye tipo "vacation" con nombre en español')
  ok(types.data.some((t: any) => t.code === 'sick_leave'), 'incluye "sick_leave"')

  // ── Festivo dentro del rango ──
  console.log('\n— Días festivos —')
  const holiday = await api('POST', '/api/public-holidays', token, { date: holidayDate, name: 'Feriado de prueba' })
  ok(holiday.status === 201, `POST /api/public-holidays → 201`)
  holidayId = holiday.data?.id
  ok(!!holidayId, 'festivo creado con id')

  // ── #188 Cálculo automático de días descontando festivos ──
  console.log('\n— Licencia: días AUTO (rango 5 días − 1 festivo = 4) —')
  const leave = await api('POST', '/api/leave-requests', token, {
    employeeId, type: 'vacation', leaveTypeId: vacation?.id, startDate: start, endDate: end, // sin `days`
  })
  ok(leave.status === 201, 'POST /api/leave-requests → 201 (sin mandar days)')
  createdLeaveIds.push(leave.data?.id)
  ok(leave.data?.days === 4, `días calculados por servidor === 4 (${leave.data?.days})`)
  ok(leave.data?.leaveTypeId === vacation?.id, 'guardó leaveTypeId')

  // ── Asignación + saldo ──
  console.log('\n— Asignación y saldo por tipo —')
  const alloc = await api('POST', '/api/leave-allocations', token, {
    employeeId, leaveTypeId: vacation?.id, year, days: 15,
  })
  ok(alloc.status === 201, 'POST /api/leave-allocations → 201')
  allocationId = alloc.data?.id

  let bal = await api('GET', `/api/leave-balance/${employeeId}?year=${year}`, token)
  ok(bal.status === 200 && Array.isArray(bal.data), 'GET /api/leave-balance → 200 array')
  let vbal = bal.data.find((b: any) => b.code === 'vacation')
  ok(vbal?.allocated === 15, `allocated === 15 (${vbal?.allocated})`)
  ok(vbal?.pending === 4, `pending === 4 (licencia sin aprobar) (${vbal?.pending})`)
  ok(vbal?.used === 0, `used === 0 antes de aprobar (${vbal?.used})`)
  ok(vbal?.remaining === 15, `remaining === 15 (solo descuenta lo aprobado) (${vbal?.remaining})`)

  // ── Aprobar → el saldo consumido pasa a "used" ──
  console.log('\n— Aprobar licencia → saldo consumido —')
  const approve = await api('POST', `/api/leave-requests/${leave.data.id}/approve`, token, {})
  ok(approve.status === 200 && approve.data?.status === 'approved', 'aprobada → status approved')
  bal = await api('GET', `/api/leave-balance/${employeeId}?year=${year}`, token)
  vbal = bal.data.find((b: any) => b.code === 'vacation')
  ok(vbal?.used === 4, `used === 4 tras aprobar (${vbal?.used})`)
  ok(vbal?.remaining === 11, `remaining === 11 (15 − 4) (${vbal?.remaining})`)

  // ── #197/calendario ──
  console.log('\n— Calendario de ausencias (rango) —')
  const cal = await api('GET', `/api/leave-calendar?from=${year}-08-01&to=${year}-08-31`, token)
  ok(cal.status === 200 && Array.isArray(cal.data), 'GET /api/leave-calendar → 200 array')
  ok(cal.data.some((l: any) => l.id === leave.data.id), 'la licencia aparece en el calendario del rango')

  // ── #190/#191 Rechazo requiere motivo ──
  console.log('\n— Rechazo requiere motivo obligatorio —')
  const leave2 = await api('POST', '/api/leave-requests', token, {
    employeeId, type: 'permission', startDate: `${year}-09-01`, endDate: `${year}-09-02`,
  })
  createdLeaveIds.push(leave2.data?.id)
  const rejectNoReason = await api('POST', `/api/leave-requests/${leave2.data.id}/reject`, token, {})
  ok(rejectNoReason.status === 400, `rechazo SIN motivo → 400 (${rejectNoReason.status})`)
  const rejectOk = await api('POST', `/api/leave-requests/${leave2.data.id}/reject`, token, { reason: 'No hay cobertura' })
  ok(rejectOk.status === 200 && rejectOk.data?.status === 'rejected', 'rechazo CON motivo → 200 rejected')
} finally {
  for (const id of createdLeaveIds) if (id) db.run('DELETE FROM leave_requests WHERE id=?', [id])
  if (holidayId) db.run('DELETE FROM public_holidays WHERE id=?', [holidayId])
  if (allocationId) db.run('DELETE FROM leave_allocations WHERE id=?', [allocationId])
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
