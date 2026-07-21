// scripts/e2e/latency.e2e.ts — Latencia p50/p95 de endpoints críticos de lectura. QA-08 (#310).
//
// Mide cuánto tarda cada endpoint GET crítico bajo carga normal (N muestras secuenciales tras un
// warmup) y lo compara contra el umbral de 200ms p95. NO valida el shape (eso lo hace
// endpoints-smoke); acá sólo importa el tiempo de respuesta.
//
//   PORT=3001 bun run src/composition-root.ts        (en otra terminal)
//   bun run scripts/e2e/latency.e2e.ts
//
// Env: BASE_URL, E2E_EMAIL, E2E_PASSWORD, SAMPLES (default 30), THRESHOLD_MS (default 200),
//      FAIL_ON_SLOW=1 → sale con código ≠0 si algún endpoint supera el umbral (para CI).

export {} // marca el archivo como módulo (aísla el scope y habilita top-level await)

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'
const SAMPLES = Number(process.env.SAMPLES ?? 30)
const THRESHOLD_MS = Number(process.env.THRESHOLD_MS ?? 200)
const FAIL_ON_SLOW = process.env.FAIL_ON_SLOW === '1'

// Endpoints críticos de lectura: los que el operador consulta en el día a día.
const ENDPOINTS = [
  '/api/dashboard',
  '/api/reservas',
  '/api/folios',
  '/api/facturas',
  '/api/huespedes',
  '/api/habitaciones',
  '/api/caja/stats',
]

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const token = ((await login.json()) as any)?.data?.token
if (!token) { console.error('❌ no se pudo loguear'); process.exit(1) }
const auth = { Authorization: `Bearer ${token}` }

console.log(`Latencia — ${SAMPLES} muestras/endpoint · umbral p95 = ${THRESHOLD_MS}ms\n`)
console.log(`  ${'endpoint'.padEnd(24)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'max'.padStart(8)}  estado`)
console.log(`  ${'─'.repeat(24)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)}  ──────`)

let slow = 0
let anyError = false
for (const ep of ENDPOINTS) {
  // Warmup: la primera lectura calienta cachés/JIT; no debe contaminar la métrica.
  await fetch(`${BASE}${ep}`, { headers: auth }).then((r) => r.text()).catch(() => {})

  const times: number[] = []
  let errors = 0
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now()
    try {
      const r = await fetch(`${BASE}${ep}`, { headers: auth })
      await r.text() // drena el body para contar el tiempo real de transferencia
      if (r.status >= 400) errors++
    } catch { errors++ }
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  const p50 = percentile(times, 50)
  const p95 = percentile(times, 95)
  const max = times[times.length - 1]
  const over = p95 > THRESHOLD_MS
  if (over) slow++
  if (errors > 0) anyError = true
  const flag = errors > 0 ? `⚠️  ${errors} err` : over ? '🐢 LENTO' : '✅ ok'
  console.log(
    `  ${ep.padEnd(24)} ${p50.toFixed(1).padStart(7)}m ${p95.toFixed(1).padStart(7)}m ${max.toFixed(1).padStart(7)}m  ${flag}`,
  )
}

console.log(`\n${'═'.repeat(60)}`)
console.log(`  ${ENDPOINTS.length - slow}/${ENDPOINTS.length} endpoints bajo ${THRESHOLD_MS}ms p95` + (slow ? ` · ${slow} lento(s)` : ''))
if (slow) console.log('  → revisar índices/WHERE en el repo de los endpoints marcados 🐢')

// Por defecto no falla (es un reporte); con FAIL_ON_SLOW=1 falla si hay lentos o errores.
process.exit(FAIL_ON_SLOW && (slow > 0 || anyError) ? 1 : 0)
