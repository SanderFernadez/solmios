// scripts/e2e/core-flow.e2e.ts — Flujo operativo/financiero core end-to-end.
//
// Verifica los contratos input/output HTTP encadenados de los módulos núcleo:
//   habitaciones → huespedes → reservas → checkin → folios (cargo) → checkout+settlement
//   → facturas → payments → caja.
// Prueba que el proceso completo (reserva → estadía → cobro → factura) es correcto.
//
//   PORT=3001 bun run --hot src/composition-root.ts   (en otra terminal)
//   bun run scripts/e2e/core-flow.e2e.ts

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

const stamp = Date.now()
const roomNumber = `E2E${String(stamp).slice(-6)}`
const created: { rooms: string[]; guests: string[]; reservations: string[] } = { rooms: [], guests: [], reservations: [] }

const db = new Database(DB_PATH)
const cleanup = () => {
  for (const id of created.reservations) {
    db.run('DELETE FROM folio_charges WHERE folioId IN (SELECT id FROM folios WHERE reservationId=?)', [id])
    db.run('DELETE FROM payments WHERE folioId IN (SELECT id FROM folios WHERE reservationId=?)', [id])
    db.run('DELETE FROM invoices WHERE reservationId=?', [id])
    db.run('DELETE FROM folios WHERE reservationId=?', [id])
    db.run('DELETE FROM reservations WHERE id=?', [id])
  }
  for (const id of created.rooms) db.run('DELETE FROM rooms WHERE id=?', [id])
  for (const id of created.guests) db.run('DELETE FROM guests WHERE id=?', [id])
  db.close()
}

let token = ''
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, data: (j as any)?.data ?? j, raw: j }
}

try {
  // ── Login ──
  const login = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })
  token = login.data?.token
  const hotelId = login.data?.user?.hotelId
  ok(login.status === 200 && !!token, 'login → 200 + token')
  ok(!!hotelId, `usuario trae hotelId → ${hotelId}`)

  // ── 1. Habitaciones: crear ──
  console.log('\n— 1. Habitaciones (POST /api/habitaciones) —')
  const room = await api('POST', '/api/habitaciones', { hotelId, number: roomNumber, type: 'single', basePrice: 100, capacity: 2 })
  ok(room.status === 201 || room.status === 200, `crear habitación → ${room.status}`)
  ok(!!room.data?.id && room.data?.number === roomNumber, `output trae id + number correctos → ${room.data?.number}`)
  ok(Number(room.data?.basePrice) === 100, `basePrice persistido = 100 → ${room.data?.basePrice}`)
  const roomId = room.data.id; created.rooms.push(roomId)

  // ── 2. Huespedes: crear ──
  console.log('\n— 2. Huespedes (POST /api/huespedes) —')
  const guest = await api('POST', '/api/huespedes', { hotelId, name: `E2E Guest ${stamp}`, email: `e2e${stamp}@test.com` })
  ok(guest.status === 201 || guest.status === 200, `crear huésped → ${guest.status}`)
  ok(!!guest.data?.id && /E2E Guest/.test(guest.data?.name || ''), 'output trae id + name')
  const guestId = guest.data.id; created.guests.push(guestId)

  // ── 3. Reservas: crear ──
  console.log('\n— 3. Reservas (POST /api/reservas) —')
  const d = (n: number) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const checkIn = d(45), checkOut = d(47) // 2 noches, lejos para no chocar
  const res = await api('POST', '/api/reservas', { hotelId, roomId, guestId, checkIn, checkOut, totalAmount: 200, status: 'confirmed', channel: 'direct' })
  ok(res.status === 201 || res.status === 200, `crear reserva → ${res.status}`)
  ok(!!res.data?.id, `output trae id → ${res.data?.id}`)
  ok(res.data?.roomId === roomId && res.data?.checkIn === checkIn, 'roomId y checkIn del input se reflejan en output')
  ok(Number(res.data?.totalAmount) === 200, `totalAmount = 200 → ${res.data?.totalAmount}`)
  const resId = res.data.id; created.reservations.push(resId)

  // ── 4. Check-in: abre folio + habitación ocupada ──
  console.log('\n— 4. Check-in (POST /api/reservas/:id/checkin) —')
  const cin = await api('POST', `/api/reservas/${resId}/checkin`, {})
  ok(cin.status === 200, `check-in → ${cin.status}`)
  ok(cin.data?.status === 'checked_in', `status → checked_in (${cin.data?.status})`)
  ok(!!cin.data?.folioId, `abrió folio → ${cin.data?.folioId}`)
  const folioId = cin.data.folioId

  // ── 5. Folio: postear un cargo (minibar) ──
  console.log('\n— 5. Folio cargo (POST /api/folios/:id/charges) —')
  const charge = await api('POST', `/api/folios/${folioId}/charges`, { amount: 50, description: 'Minibar E2E', category: 'minibar' })
  ok(charge.status === 200 || charge.status === 201, `postear cargo → ${charge.status}`)
  ok(Number(charge.data?.amount) === 50, `cargo amount = 50 → ${charge.data?.amount}`)
  const folio = await api('GET', `/api/folios/${folioId}`)
  ok((folio.data?.balance ?? 0) > 0, `folio tiene balance > 0 tras cargos → ${folio.data?.balance}`)

  // ── 6. Check-out con settlement: cierra folio → factura → pago ──
  console.log('\n— 6. Check-out + settlement (POST /api/reservas/:id/checkout) —')
  const balance = Number(folio.data?.balance) || 0
  // Cobro PARCIAL: deja saldo > 0 tras el pago → el settlement emite factura por el saldo.
  // (Cobro total dejaría balance 0 y cierra el folio SIN factura, por diseño — CLAUDE.md.)
  const settleAmount = Math.max(1, Math.floor(balance / 2))
  const cout = await api('POST', `/api/reservas/${resId}/checkout`, { settle: { method: 'cash', amount: settleAmount, reference: 'E2E' } })
  if (cout.status !== 200) console.error('    ↳ checkout error body:', JSON.stringify(cout.raw))
  ok(cout.status === 200, `check-out → ${cout.status}`)
  ok(cout.data?.status === 'checked_out', `status → checked_out (${cout.data?.status})`)
  const st = cout.data?.settlement
  ok(!!st && !!st.folioId, 'settlement trae folioId')
  ok(!!st?.invoiceId, `settlement emitió factura (cobro parcial) → ${st?.invoiceId}`)
  ok(Number(st?.amountPaid) === settleAmount, `amountPaid = lo cobrado (${st?.amountPaid} == ${settleAmount})`)

  // ── 7. Factura emitida: verificar output ──
  console.log('\n— 7. Factura (GET /api/facturas/:id) —')
  if (st?.invoiceId) {
    const inv = await api('GET', `/api/facturas/${st.invoiceId}`)
    ok(inv.status === 200 && inv.data?.id === st.invoiceId, 'factura existe con el id del settlement')
    ok(!!inv.data?.invoiceNumber, `factura tiene número → ${inv.data?.invoiceNumber}`)
    ok(Number(inv.data?.amount) > 0, `factura amount > 0 → ${inv.data?.amount}`)
  }

  // ── 8. Payment asentado (fuente de verdad del dinero) ──
  console.log('\n— 8. Payments (dinero asentado) —')
  const payRow = db.query("SELECT method, amount, status FROM payments WHERE folioId=? ORDER BY createdAt DESC LIMIT 1").get(folioId) as any
  ok(!!payRow, 'existe un payment ligado al folio')
  ok(payRow?.method === 'cash' && Number(payRow?.amount) === settleAmount, `payment cash por lo cobrado (${payRow?.method}/${payRow?.amount})`)
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
} finally {
  cleanup()
}

console.log(`\n${'═'.repeat(48)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
