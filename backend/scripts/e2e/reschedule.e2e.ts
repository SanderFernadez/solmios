// scripts/e2e/reschedule.e2e.ts — Mover/extender reserva desde el planning (#204/#207).
//
// Siembra una habitación + reserva de control y ejercita:
//   1. quote (dry-run): calcula noches/diferencia y disponibilidad, sin escribir.
//   2. commit + cargo a folio: extiende y postea la diferencia al folio abierto.
//   3. commit + cobro efectivo: extiende y registra un pago cash (→ caja).
//   4. commit + monto override: el recepcionista fija el monto a mano.
//   5. conflicto de solape: mover a una habitación ocupada → available:false.
//
//   PORT=3001 bun run --hot src/composition-root.ts   (en otra terminal)
//   bun run scripts/e2e/reschedule.e2e.ts

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

const db = new Database(DB_PATH)
// El hotelId DEBE ser el del usuario logueado, o assertOwnership da 403.
const seedUser = db.query('SELECT hotelId FROM users WHERE email=?').get(EMAIL) as any
if (!seedUser?.hotelId) { console.error(`El usuario ${EMAIL} no tiene hotelId`); process.exit(1) }
const hotelId = seedUser.hotelId
const now = new Date().toISOString()
const uid = () => crypto.randomUUID()

// ── Seed: 3 habitaciones (basePrice 100) + reserva de control + reserva no-rack + reserva que ocupa la hab B
const roomA = uid(), roomB = uid(), roomC = uid(), resId = uid(), blockerId = uid(), resNonRack = uid()
db.run('INSERT INTO rooms (id,number,name,type,basePrice,status,hotelId,capacity,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
  [roomA, 'E2E-A', 'E2E Room A', 'standard', 100, 'available', hotelId, 2, now, now])
db.run('INSERT INTO rooms (id,number,name,type,basePrice,status,hotelId,capacity,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
  [roomB, 'E2E-B', 'E2E Room B', 'standard', 100, 'available', hotelId, 2, now, now])
db.run('INSERT INTO reservations (id,roomId,hotelId,checkIn,checkOut,status,channel,totalAmount,currency,adults,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  [resId, roomA, hotelId, '2026-08-01', '2026-08-03', 'confirmed', 'direct', 200, 'USD', 2, now, now])
db.run('INSERT INTO reservations (id,roomId,hotelId,checkIn,checkOut,status,channel,totalAmount,currency,adults,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  [blockerId, roomB, hotelId, '2026-08-01', '2026-08-10', 'confirmed', 'direct', 900, 'USD', 2, now, now])
// Reserva NO-rack: total 396 para 3 noches (tarifa distinta a basePrice 100). Extender NO debe repreciar.
db.run('INSERT INTO rooms (id,number,name,type,basePrice,status,hotelId,capacity,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
  [roomC, 'E2E-C', 'E2E Room C', 'standard', 100, 'available', hotelId, 2, now, now])
db.run('INSERT INTO reservations (id,roomId,hotelId,checkIn,checkOut,status,channel,totalAmount,currency,adults,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  [resNonRack, roomC, hotelId, '2026-08-01', '2026-08-04', 'confirmed', 'direct', 396, 'USD', 2, now, now])

const cleanup = () => {
  db.run('DELETE FROM folio_charges WHERE hotelId=? AND source=?', [hotelId, 'reschedule'])
  db.run("DELETE FROM payments WHERE hotelId=? AND description LIKE 'Cambio de reserva%'", [hotelId])
  db.run('DELETE FROM folios WHERE reservationId IN (?,?)', [resId, resNonRack])
  db.run('DELETE FROM reservations WHERE id IN (?,?,?)', [resId, blockerId, resNonRack])
  db.run('DELETE FROM rooms WHERE id IN (?,?,?)', [roomA, roomB, roomC])
  db.close()
}

const post = async (path: string, token: string, body: any) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, data: (j as any)?.data ?? j }
}

try {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  const token = ((await login.json()) as any)?.data?.token
  ok(login.status === 200 && !!token, 'login → 200 + token')

  // ── 1. QUOTE (dry-run) — extender 2→4 noches ──
  console.log('\n— #1 Quote (dry-run): extender a 4 noches —')
  const q = await post(`/api/reservas/${resId}/reschedule/quote`, token, { checkOut: '2026-08-05' })
  ok(q.status === 200, 'quote → 200')
  ok(q.data.oldNights === 2 && q.data.newNights === 4, `noches 2→4 (old=${q.data.oldNights} new=${q.data.newNights})`)
  ok(q.data.previousTotal === 200, `total previo 200 → ${q.data.previousTotal}`)
  ok(q.data.quotedNewPrice === 400, `precio nuevo 400 (100×4) → ${q.data.quotedNewPrice}`)
  ok(q.data.difference === 200, `diferencia 200 → ${q.data.difference}`)
  ok(q.data.available === true, 'habitación disponible en el rango nuevo')
  // dry-run: no debe haber tocado la reserva
  const after = db.query('SELECT checkOut, totalAmount FROM reservations WHERE id=?').get(resId) as any
  ok(after.checkOut === '2026-08-03' && after.totalAmount === 200, 'quote NO modificó la reserva (dry-run)')

  // ── 2. COMMIT + cargo a folio ──
  console.log('\n— #2 Commit + cargo a folio —')
  const c1 = await post(`/api/reservas/${resId}/reschedule`, token, { checkOut: '2026-08-05', charge: { method: 'folio' } })
  ok(c1.status === 200, 'commit folio → 200')
  ok(c1.data.reservation?.checkOut === '2026-08-05', `reserva extendida a 2026-08-05 → ${c1.data.reservation?.checkOut}`)
  ok(c1.data.reservation?.totalAmount === 400, `total actualizado 400 → ${c1.data.reservation?.totalAmount}`)
  ok(c1.data.quote?.chargeAmount === 200, `monto a cobrar 200 → ${c1.data.quote?.chargeAmount}`)
  ok(c1.data.charge?.applied === true && c1.data.charge?.target === 'folio', 'cargo aplicado al folio')
  ok(!!c1.data.charge?.folioId, `folioId presente → ${c1.data.charge?.folioId}`)
  const fc = db.query('SELECT amount, source, category FROM folio_charges WHERE folioId=? AND source=?').get(c1.data.charge?.folioId, 'reschedule') as any
  ok(!!fc && fc.amount === 200 && fc.category === 'room', `folio_charge en DB: amount=${fc?.amount} category=${fc?.category}`)

  // ── 3. COMMIT + cobro efectivo (extender 4→6) ──
  console.log('\n— #3 Commit + cobro efectivo —')
  const c2 = await post(`/api/reservas/${resId}/reschedule`, token, { checkOut: '2026-08-07', charge: { method: 'cash' } })
  ok(c2.status === 200, 'commit cash → 200')
  ok(c2.data.reservation?.totalAmount === 600, `total 600 (100×6) → ${c2.data.reservation?.totalAmount}`)
  ok(c2.data.charge?.applied === true && c2.data.charge?.target === 'cash', 'cobro en efectivo aplicado')
  const payRow = db.query("SELECT method, status, amount, metadata FROM payments WHERE hotelId=? AND description LIKE 'Cambio de reserva%' ORDER BY createdAt DESC LIMIT 1").get(hotelId) as any
  ok(!!payRow && payRow.method === 'cash' && payRow.status === 'completed', `payment cash completed: ${payRow?.method}/${payRow?.status}`)
  ok(payRow?.amount === 200, `monto del pago 200 (diff 4→6) → ${payRow?.amount}`)
  const meta = payRow?.metadata ? JSON.parse(payRow.metadata) : {}
  ok(meta.reservationId === resId && meta.source === 'reschedule', 'payment.metadata linkea la reserva')

  // ── 4. COMMIT + monto override (recepcionista fija el monto) ──
  console.log('\n— #4 Commit + monto override —')
  const c3 = await post(`/api/reservas/${resId}/reschedule`, token, { checkOut: '2026-08-09', charge: { method: 'cash', amount: 50, reason: 'descuento cliente frecuente' } })
  ok(c3.status === 200, 'commit override → 200')
  ok(c3.data.quote?.chargeAmount === 50, `cobra el override 50 (no la diff 200) → ${c3.data.quote?.chargeAmount}`)
  ok(c3.data.reservation?.totalAmount === 650, `total = previo 600 + override 50 = 650 → ${c3.data.reservation?.totalAmount}`)

  // ── 5. Conflicto de solape: mover a la habitación B (ocupada) ──
  console.log('\n— #5 Conflicto: mover a habitación ocupada —')
  const q2 = await post(`/api/reservas/${resId}/reschedule/quote`, token, { roomId: roomB, checkIn: '2026-08-02', checkOut: '2026-08-04' })
  ok(q2.status === 200 && q2.data.available === false, 'quote marca available:false (solape con blocker)')
  const c4 = await post(`/api/reservas/${resId}/reschedule`, token, { roomId: roomB, checkIn: '2026-08-02', checkOut: '2026-08-04', charge: { method: 'folio' } })
  ok(c4.status === 409, `commit a habitación ocupada → 409 (fue ${c4.status})`)

  // ── 6. Precio NO-rack: extender NO reprecia (cobra solo las noches agregadas) ──
  console.log('\n— #6 Extender reserva con total no-rack (396 por 3n) —')
  const q6 = await post(`/api/reservas/${resNonRack}/reschedule/quote`, token, { checkOut: '2026-08-05' })
  ok(q6.status === 200, 'quote no-rack → 200')
  ok(q6.data.previousTotal === 396, `total previo 396 (no-rack) → ${q6.data.previousTotal}`)
  ok(q6.data.difference === 100, `diferencia = 1 noche × 100 = 100 (NO reprecia) → ${q6.data.difference}`)
  ok(q6.data.quotedNewPrice === 496, `nuevo total = 396 + 100 = 496 (NO 400) → ${q6.data.quotedNewPrice}`)
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
} finally {
  cleanup()
}

console.log(`\n${'═'.repeat(44)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
