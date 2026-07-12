// scripts/e2e/appraisals.e2e.ts — E2E de Evaluaciones a nivel Odoo (Ola 3).
//
// Verifica: plantillas configurables (default sembrada), borrador editable (#193), límite de
// puntaje 1-10 (#192), auto-evaluación del empleado, y completado = inmutable / solo lectura (#194).
//
//   bun run scripts/e2e/appraisals.e2e.ts
//
// Idempotente: borra la review que crea (las plantillas quedan como config).

import { Database } from 'bun:sqlite'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const DB_PATH = process.env.DB_PATH ?? 'data/managerhotel.db'
const EMAIL = process.env.E2E_EMAIL ?? 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo123'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.error(`  ❌ ${m}`)) }

const db = new Database(DB_PATH)
const row = db.query('SELECT id, hotelId FROM employee_profiles WHERE active=1 LIMIT 1').get() as any
if (!row) { console.error('Falta seed de empleados'); process.exit(1) }
const employeeId = row.id, hotelId = row.hotelId
const reviewerRow = db.query('SELECT id FROM employee_profiles WHERE hotelId=? AND id != ? LIMIT 1').get(hotelId, employeeId) as any
const reviewerId = reviewerRow?.id ?? employeeId
const createdReviewIds: string[] = []
let createdTemplateId = ''

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

  // ── Plantillas configurables (default sembrada) ──
  console.log('\n— Plantillas de evaluación —')
  const tpls = await api('GET', '/api/appraisal-templates', token)
  ok(tpls.status === 200 && Array.isArray(tpls.data), 'GET /api/appraisal-templates → 200 array')
  ok(tpls.data.length >= 1, `sembró ≥1 plantilla por defecto (${tpls.data.length})`)
  const defaultTpl = tpls.data[0]
  ok(JSON.parse(defaultTpl.questions).length >= 3, 'la plantilla por defecto tiene preguntas')

  const newTpl = await api('POST', '/api/appraisal-templates', token, {
    name: 'Evaluación de recepción', questions: ['¿Puntualidad?', '¿Atención al huésped?'],
  })
  ok(newTpl.status === 201, 'POST plantilla → 201')
  createdTemplateId = newTpl.data?.id
  ok(JSON.parse(newTpl.data.questions).length === 2, 'guardó las 2 preguntas como JSON')

  // ── Crear review (draft) con auto-evaluación ──
  console.log('\n— Crear evaluación (borrador) con auto-evaluación —')
  const created = await api('POST', '/api/performance-reviews', token, {
    employeeId, reviewerId, reviewDate: '2026-07-01', period: '2026-Q3',
    score: 7, strengths: 'Buen trato', selfScore: 8, selfComments: 'Me esforcé este trimestre',
    templateId: defaultTpl.id,
  })
  ok(created.status === 201, 'POST /api/performance-reviews → 201')
  createdReviewIds.push(created.data?.id)
  ok(created.data?.status === 'draft', 'nace en status draft')
  ok(created.data?.selfScore === 8, `guardó selfScore del empleado (${created.data?.selfScore})`)
  ok(created.data?.selfComments === 'Me esforcé este trimestre', 'guardó selfComments')

  // ── #193 Borrador editable ──
  console.log('\n— #193 Borrador editable —')
  const upd = await api('PUT', `/api/performance-reviews/${created.data.id}`, token, {
    score: 9, strengths: 'Excelente liderazgo', improvements: 'Delegar más',
  })
  ok(upd.status === 200, 'PUT borrador → 200')
  ok(upd.data?.score === 9, `score actualizado a 9 (${upd.data?.score})`)
  ok(upd.data?.strengths === 'Excelente liderazgo', 'strengths actualizado')

  // ── #192 Puntaje fuera de rango ──
  console.log('\n— #192 Límite de puntaje 1-10 —')
  const bad = await api('PUT', `/api/performance-reviews/${created.data.id}`, token, { score: 15 })
  ok(bad.status === 400, `score=15 → 400 (${bad.status})`)
  const bad0 = await api('PUT', `/api/performance-reviews/${created.data.id}`, token, { score: 0 })
  ok(bad0.status === 400, `score=0 → 400 (${bad0.status})`)

  // ── Completar → #194 inmutable ──
  console.log('\n— Completar → #194 solo lectura —')
  const done = await api('POST', `/api/performance-reviews/${created.data.id}/complete`, token, {})
  ok(done.status === 200 && done.data?.status === 'completed', 'completada → status completed')
  const editAfter = await api('PUT', `/api/performance-reviews/${created.data.id}`, token, { score: 5 })
  ok(editAfter.status === 400, `editar completada → 400 (solo lectura) (${editAfter.status})`)
} finally {
  for (const id of createdReviewIds) if (id) db.run('DELETE FROM performance_reviews WHERE id=?', [id])
  if (createdTemplateId) db.run('DELETE FROM appraisal_templates WHERE id=?', [createdTemplateId])
  db.close()
}

console.log(`\n${'═'.repeat(40)}\n  ${pass} passed · ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
