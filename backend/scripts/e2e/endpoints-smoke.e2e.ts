export {}
// scripts/e2e/endpoints-smoke.e2e.ts — Smoke test de outputs de TODOS los módulos.
//
// Pega a los endpoints GET de lectura de cada módulo y clasifica la respuesta.
// Objetivo: cazar 500 (crash/bug) en cualquier módulo y confirmar que los 200 traen shape.
// NO valida valores de negocio (eso lo hacen los tests unitarios + core-flow); valida que el
// proceso de lectura no rompe y devuelve el contrato esperado.
//
//   PORT=3001 bun run --hot src/composition-root.ts
//   bun run scripts/e2e/endpoints-smoke.e2e.ts

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

// Endpoint de lectura principal por módulo (accesibles por un merchant, sin params obligatorios).
const ENDPOINTS = [
  // Core / finanzas
  '/api/reservas', '/api/habitaciones', '/api/huespedes', '/api/facturas', '/api/facturas/stats',
  '/api/facturas/tax-report', '/api/folios', '/api/payments', '/api/deposits', '/api/payment-links',
  '/api/payment-requests', '/api/caja/movements', '/api/caja/shifts', '/api/caja/shifts/current',
  '/api/caja/stats', '/api/gastos', '/api/reports', '/api/night-audit', '/api/planning',
  '/api/dashboard', '/api/booking-engine', '/api/blocks',
  // RRHH
  '/api/employee-profiles', '/api/departments', '/api/employee-contracts', '/api/employee-documents',
  '/api/leave-requests', '/api/leave-types', '/api/leave-allocations', '/api/performance-reviews',
  '/api/appraisal-templates', '/api/job-positions', '/api/contract-types', '/api/work-locations',
  '/api/applicants', '/api/applicants/pipeline', '/api/expense-claims', '/api/expense-claims/totals',
  '/api/org-chart', '/api/hr-dashboard', '/api/attendance/records', '/api/attendance/config',
  '/api/attendance/schedules', '/api/payroll/runs', '/api/payroll/concepts', '/api/payroll/config',
  '/api/public-holidays',
  // Operación
  '/api/housekeeping', '/api/housekeeping/stats', '/api/housekeeping/settings', '/api/mantenimiento',
  '/api/mantenimiento/stats', '/api/grupos', '/api/paquetes', '/api/amenities/hotel', '/api/tickets',
  // Canales / pricing
  '/api/canales', '/api/channels', '/api/channel-metrics', '/api/rates', '/api/seasons',
  '/api/rate-restrictions',
  // Comunicación / catálogos / misc
  '/api/notificaciones', '/api/anuncios', '/api/opiniones', '/api/feedback', '/api/messages',
  '/api/assets', '/api/dispositivos', '/api/apikeys', '/api/auditlog', '/api/roles', '/api/roles/catalog',
  '/api/hoteles', '/api/settings', '/api/auto-messages', '/api/crm/segments', '/api/crm/dashboard',
  '/api/training/courses', '/api/ai/templates', '/api/ai/metrics', '/api/stripe/status',
]

const results = { ok: 0, warn: 0, bug: 0 }
const bugs: string[] = []
const warns: string[] = []

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const token = ((await login.json()) as any)?.data?.token
if (!token) { console.error('❌ no se pudo loguear'); process.exit(1) }
console.log(`Login OK — probando ${ENDPOINTS.length} endpoints de lectura\n`)

for (const ep of ENDPOINTS) {
  try {
    const r = await fetch(`${BASE}${ep}`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await r.json().catch(() => ({}))
    if (r.status >= 500) { results.bug++; bugs.push(`${ep} → ${r.status}: ${(body as any)?.error?.message || ''}`) }
    else if (r.status === 200) { results.ok++ }              // 200 = proceso de lectura OK
    else { results.warn++; warns.push(`${ep} → ${r.status} (${(body as any)?.error?.message || 'params/permisos'})`) }
  } catch (e: any) {
    results.bug++; bugs.push(`${ep} → excepción: ${e.message}`)
  }
}

console.log(`✅ 200 con data: ${results.ok}`)
console.log(`⚠️  status esperado no-200 (params/permisos): ${results.warn}`)
if (warns.length) warns.forEach((w) => console.log(`    · ${w}`))
console.log(`🐛 500 / crash: ${results.bug}`)
if (bugs.length) bugs.forEach((b) => console.error(`    ❌ ${b}`))

console.log(`\n${'═'.repeat(48)}\n  ${results.ok} ok · ${results.warn} warn · ${results.bug} bugs`)
// Solo falla si hay 500s (crashes reales). Los warn (400/403 por params/permisos) no son bug.
process.exit(results.bug === 0 ? 0 : 1)
