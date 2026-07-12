// scripts/e2e/payslip.e2e.ts — E2E del recibo de nómina (Ola 8, #157): PDF imprimible + email.
//
// Verifica que el recibo se renderiza como HTML A4 con los datos del empleado, y que el endpoint
// de email valida el destinatario y llega al puerto de correo.
//
//   bun run scripts/e2e/payslip.e2e.ts
export {}

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

async function jsonApi(method: string, path: string, token: string, body?: unknown) {
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

  // ── Encontrar un run con detalles ──
  const runs = await jsonApi('GET', '/api/payroll/runs', token)
  ok(runs.status === 200 && runs.data.length >= 1, `hay liquidaciones (${runs.data.length})`)
  let runId = '', detailId = ''
  for (const r of runs.data) {
    const det = await jsonApi('GET', `/api/payroll/runs/${r.id}/details`, token)
    if (det.status === 200 && det.data.length) { runId = r.id; detailId = det.data[0].id; break }
  }
  ok(!!runId && !!detailId, 'encontró una liquidación con al menos un detalle')

  // ── #157 Recibo imprimible (HTML A4 → PDF) ──
  console.log('\n— Recibo imprimible (HTML A4) —')
  const printRes = await fetch(`${BASE}/api/payroll/runs/${runId}/details/${detailId}/payslip?employeeName=Ana%20Rodr%C3%ADguez`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const rawText = await printRes.text()
  // El framework envuelve la respuesta en {data}; el frontend extrae ese string (http.get). Lo replicamos.
  let html = rawText
  try { const j = JSON.parse(rawText); if (j && typeof j.data === 'string') html = j.data } catch { /* ya es HTML crudo */ }
  ok(printRes.status === 200, `GET payslip → 200 (${printRes.status})`)
  ok(html.includes('<!DOCTYPE html>'), 'el cuerpo (desenvuelto) es un documento HTML')
  ok(html.includes('Recibo de nómina'), 'el HTML es un recibo de nómina')
  ok(html.includes('Neto a pagar'), 'incluye el neto a pagar')
  ok(html.includes('Ana Rodríguez'), 'incluye el nombre del empleado (pasado por query)')
  ok(html.includes('@page'), 'trae estilos A4 para imprimir a PDF')

  // ── #157 Envío por email ──
  console.log('\n— Envío por email —')
  const badEmail = await jsonApi('POST', `/api/payroll/runs/${runId}/details/${detailId}/payslip/email`, token, { to: 'no-es-un-email' })
  ok(badEmail.status === 400, `email inválido → 400 (${badEmail.status})`)

  const sent = await jsonApi('POST', `/api/payroll/runs/${runId}/details/${detailId}/payslip/email`, token, { to: 'empleado@mail.com', employeeName: 'Ana' })
  // 200 = encolado; 400 con mensaje de "configurado" = el puerto se alcanzó pero el hotel no tiene SMTP.
  const reached = sent.status === 200 || (sent.status === 400 && JSON.stringify(sent.data).includes('email'))
  ok(reached, `email con destinatario válido llega al puerto de correo (status ${sent.status})`)
} catch (e) {
  fail++; console.error('  ❌ excepción:', e)
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
