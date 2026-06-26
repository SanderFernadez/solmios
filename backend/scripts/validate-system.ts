/**
 * validate-system.ts — Suite de validación E2E de Manager Hotel (SOLMI OS)
 *
 * Hittea los endpoints clave (core + capa amarilla + integraciones) con un user demo
 * y reporta estado real por feature: ✅ OK / 🟡 vivo-sin-datos / ⚠ auth-rol / ❌ no-existe-error.
 *
 * Uso:  cd backend && bun run scripts/validate-system.ts
 *   (requiere el backend corriendo en :3000 — `pm2 start ecosystem.config.cjs`)
 *
 * No es destructivo: solo GETs de lista/status. No crea/modifica datos.
 */
const PORT = process.env.PORT || '3000'
const BASE = process.env.VALIDATE_BASE || `http://localhost:${PORT}`
const DEMO = { email: 'admin@caribeparadise.com', password: 'demo123' }

type Check = { group: string; name: string; method: 'GET' | 'POST'; path: string; auth?: boolean; note?: string }

const HOTEL_ID = 'bca45933-075b-4f0b-bed2-322c3cd7a216' // Hotel Boutique Palma (admin@caribeparadise)

const core = ['reservas', 'habitaciones', 'huespedes', 'folios', 'facturas', 'housekeeping', 'mantenimiento', 'opiniones', 'gastos', 'paquetes', 'grupos', 'tickets', 'notificaciones', 'anuncios', 'apikeys', 'dispositivos', 'roles', 'hoteles', 'usuarios', 'auditlog']

const checks: Check[] = [
  ...core.map((m) => ({ group: 'Core PMS', name: m, method: 'GET' as const, path: `/api/${m}`, auth: true })),
  { group: 'Talento & Nómina', name: 'empleados', method: 'GET', path: '/api/employee-profiles', auth: true },
  { group: 'Talento & Nómina', name: 'payroll', method: 'GET', path: '/api/payroll/runs', auth: true },
  { group: 'Talento & Nómina', name: 'attendance', method: 'GET', path: '/api/attendance/records', auth: true },
  { group: 'Finanzas & CRM', name: 'payments', method: 'GET', path: '/api/payments', auth: true },
  { group: 'Finanzas & CRM', name: 'crm-coupons', method: 'GET', path: '/api/crm/coupons', auth: true },
  { group: 'Finanzas & CRM', name: 'auto-messages', method: 'GET', path: '/api/auto-messages', auth: true },
  { group: 'Finanzas & CRM', name: 'message-logs', method: 'GET', path: '/api/message-logs', auth: true },
  { group: 'Distribución', name: 'channels', method: 'GET', path: '/api/channels', auth: true },
  { group: 'Distribución', name: 'booking-engine', method: 'GET', path: '/api/booking-engine', auth: true },

  // ── Capa amarilla (features del plan) ──
  { group: '🟡 Amenities', name: 'catalog', method: 'GET', path: '/api/amenities/catalog', auth: true },
  { group: '🟡 Amenities', name: 'hotel', method: 'GET', path: '/api/amenities/hotel', auth: true },
  { group: '🟡 Seasons', name: 'list', method: 'GET', path: '/api/seasons', auth: true },
  { group: '🟡 Rates', name: 'list', method: 'GET', path: '/api/rates', auth: true },
  { group: '🟡 TTLock', name: 'config', method: 'GET', path: '/api/ttlock/config', auth: true },
  { group: '🟡 TTLock', name: 'locks', method: 'GET', path: '/api/ttlock/locks', auth: true },
  { group: '🟡 Pre-checkin', name: 'public-hash', method: 'GET', path: '/api/public/pre-checkin/invalid000', note: 'público' },

  // ── Integraciones (status) ──
  { group: '🔌 Integraciones', name: 'stripe-status', method: 'GET', path: '/api/stripe/status', auth: true },
  { group: '🔌 Integraciones', name: 'whatsapp-status', method: 'GET', path: `/api/ai/whatsapp/status/${HOTEL_ID}`, auth: true },
  { group: '🔌 Integraciones', name: 'whatsapp-config', method: 'GET', path: '/api/ai/whatsapp/config', auth: true },
]

async function login(): Promise<string | null> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO),
  })
  const j = (await r.json()) as any
  return j?.data?.token ?? null
}

function classify(status: number, bodyText: string, isPublic?: boolean): { icon: string; note: string } {
  const body = bodyText.slice(0, 120).replace(/\n/g, ' ')
  if (status >= 500) return { icon: '❌', note: `server error: ${body.slice(0, 50)}` }
  if (status === 404) {
    // distinguir "ruta no existe" (Cannot GET) vs "recurso no encontrado" (negocio)
    if (/cannot\s+(get|post|put|delete)/i.test(body) || /route\s+not\s+found/i.test(body)) return { icon: '❌', note: 'ruta NO existe' }
    return { icon: '✅', note: 'ruta existe (404 de recurso esperado)' }
  }
  if (status === 401 || status === 403) return { icon: '⚠', note: `auth ${status}` }
  if (status >= 200 && status < 300) {
    try {
      const j = JSON.parse(bodyText) as any
      const d = j?.data
      const isEmpty = Array.isArray(d) ? d.length === 0 : d === null || d === undefined || (typeof d === 'object' && d !== null && Object.keys(d).length === 0)
      return isEmpty ? { icon: '🟡', note: 'vivo, sin datos' } : { icon: '✅', note: '' }
    } catch {
      return { icon: '✅', note: '' }
    }
  }
  return { icon: '⚠', note: `HTTP ${status}` }
}

async function run() {
  console.log(`\n🔍 Validando Manager Hotel en ${BASE}\n`)
  let token: string | null = null
  try {
    token = await login()
  } catch (e: any) {
    console.error(`❌ No se pudo conectar a ${BASE} — ¿el backend está corriendo? (pm2 start ecosystem.config.cjs)\n   ${e?.message}`)
    process.exit(1)
  }
  if (!token) {
    console.error('❌ Login falló (credenciales demo). Revisa seeds o el user admin@caribeparadise.com.')
    process.exit(1)
  }
  console.log(`✅ Login OK · admin@caribeparadise.com\n`)

  // Companions se lista POR RESERVA (no hay lista global): obtener una reserva real para validar el endpoint correcto.
  try {
    const rr = await fetch(`${BASE}/api/reservas`, { headers: { Authorization: `Bearer ${token}` } })
    const rj = (await rr.json()) as any
    const firstId = Array.isArray(rj?.data) ? rj.data[0]?.id : rj?.data?.id
    if (firstId) checks.push({ group: '🟡 Companions', name: 'list', method: 'GET', path: `/api/reservations/${firstId}/companions`, auth: true })
    else checks.push({ group: '🟡 Companions', name: 'list', method: 'GET', path: '/api/reservations/noid/companions', auth: true, note: 'sin reservas demo' })
  } catch {}

  const results: { c: Check; status: number; icon: string; note: string }[] = []
  for (const c of checks) {
    try {
      const headers: Record<string, string> = {}
      if (c.auth) headers['Authorization'] = `Bearer ${token}`
      const r = await fetch(`${BASE}${c.path}`, { method: c.method, headers })
      const bodyText = await r.text()
      const { icon, note } = classify(r.status, bodyText, !c.auth)
      results.push({ c, status: r.status, icon, note })
    } catch (e: any) {
      results.push({ c, status: 0, icon: '❌', note: String(e?.message || e).slice(0, 50) })
    }
  }

  const groups = [...new Set(results.map((r) => r.c.group))]
  for (const g of groups) {
    console.log(`── ${g} ${'─'.repeat(Math.max(2, 40 - g.length))}`)
    for (const r of results.filter((x) => x.c.group === g)) {
      const pad = r.c.name.padEnd(18)
      const extra = r.c.note ? ` (${r.c.note})` : ''
      console.log(`  ${r.icon} ${pad} ${String(r.status).padEnd(4)} ${r.note}${extra}`)
    }
  }

  const tally = (icon: string) => results.filter((r) => r.icon === icon).length
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ OK: ${tally('✅')}  🟡 vivo-sin-datos: ${tally('🟡')}  ⚠ auth: ${tally('⚠')}  ❌ fail: ${tally('❌')}  / ${results.length} checks`)
  const failed = results.filter((r) => r.icon === '❌')
  if (failed.length) {
    console.log(`\n❌ Endpoints con problemas:`)
    for (const r of failed) console.log(`   ${r.c.method} ${r.c.path} → ${r.status} ${r.note}`)
  }
  console.log('')
}

run()
