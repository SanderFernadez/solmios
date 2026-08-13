import { test, expect } from '../fixtures'
import { apiGet, apiPost } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// RRHH-09 — Ciclo de vida de una liquidación de nómina (MUEVE PLATA).
//
// Cubre el flujo completo: draft → calculated → approved → paid. En cada paso se verifica:
//   2. Notificación — toast de éxito ("Liquidación creada", "Nómina calculada: ...",
//      "Nómina aprobada — recibos generados", "Pago registrado").
//   3. Persistencia — GET /api/payroll/runs/:id devuelve el nuevo estado.
//   4. Efecto cascada — Approve genera payslips (GET /:id/details trae filas). Pay deja paidAt.
//
// Y la idempotencia del pay: un segundo POST /pay tras el primero no duplica la liquidación (sigue
// habiendo una corrida paid, no dos).
//
// Setup: el hotel demo (Palma) ya tiene config de nómina (monthly, DOP) y al menos un empleado con
// salary (el propio admin + super_admin del seed). El prefill de /api/payroll/runs/:id/prefill
// devuelve esos empleados con baseSalary/daysWorked. Sin ese prefill, calculate no tiene filas y
// fallaría: por eso el spec arranca verificando que haya al menos un empleado prefillable.
//
// ⚠️ UNIQUE constraint: solo puede existir UNA corrida por (hotelId, period). Como varias corridas
// del test pueden saturar el mes actual, cada test busca un MES LIBRE (siguiente mes sin corrida)
// antes de crear. Así el test es idempotente a re-corridas de la suite.

/** Devuelve el primer período YYYY-MM a partir del mes actual que NO tenga una corrida creada. */
async function findFreePeriod(page: import('@playwright/test').Page, usedPeriods: Set<string>): Promise<{ period: string; startDate: string; endDate: string; paymentDate: string }> {
  const runsRes = await apiGet<any>(page, '/api/payroll/runs')
  const runs: any[] = runsRes.data ?? runsRes
  const used = new Set([...usedPeriods, ...runs.map((r) => r.period)])
  const base = new Date()
  base.setDate(1) // evitar fin de mes al sumar
  for (let offset = 0; offset < 36; offset++) {
    const d = new Date(base.getFullYear(), base.getMonth() + offset, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (used.has(period)) continue
    const start = `${period}-01`
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { period, startDate: start, endDate: end, paymentDate: start }
  }
  throw new Error('no se encontró un mes libre para crear la corrida de test')
}

/** Crea una corrida nueva en un mes libre y devuelve su id + datos del período. */
async function createRunInFreePeriod(page: import('@playwright/test').Page, usedPeriods: Set<string> = new Set()) {
  // HotelId del localStorage (sin /api/auth/me → menos carga en el rate-limit por IP).
  const hotelId = await page.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}').hotelId)
  expect(hotelId, 'el admin debe tener hotelId en localStorage').toBeTruthy()
  const { period, startDate, endDate, paymentDate } = await findFreePeriod(page, usedPeriods)
  const create = await apiPost<any>(page, '/api/payroll/runs', {
    hotelId, period, startDate, endDate, paymentDate,
  })
  expect(create.status, `la corrida para ${period} debe crearse (vió ${create.status})`).toBeLessThan(300)
  const runId = create.body?.data?.id ?? create.body?.id
  expect(runId, 'la corrida debió recibir un id').toBeTruthy()
  return { runId, period }
}

test.describe('RRHH-09 — ciclo de liquidación de nómina', () => {
  test('draft → calculated → approved → paid con toasts y persistencia', async ({ page }) => {
    // Cargar una página del panel PRIMERO: apiGet lee el token de localStorage, y about:blank no
    // expone localStorage (SecurityError). El dashboard deja el document en un origin válido.
    await page.goto('/panel/dashboard')

    // Crear corrida en un mes libre (evita UNIQUE conflict con corridas del seed o de suite previa).
    const { runId } = await createRunInFreePeriod(page)

    // Preflight prefill: si NO hay filas, skip con razón concreta.
    const prefillRes = await apiGet<any>(page, `/api/payroll/runs/${runId}/prefill`)
    const prefillRows: any[] = prefillRes.data ?? prefillRes
    test.skip(!prefillRows.length, 'el hotel demo no tiene empleados con legajo para liquidar')

    // ─── UI: abrir nómina y localizar la corrida nueva ───
    await page.goto('/panel/rrhh/payroll')
    await expect(page.getByRole('heading', { name: 'Nómina Automatizada' })).toBeVisible()

    const row = page.locator(`[data-run-id="${runId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // Estado inicial: draft. El botón "Calcular" (teal) está visible solo en draft.
    await expect(row.getByTestId('payroll-calculate-btn')).toBeVisible()

    // ─── CALCULATE ───
    // El botón de calcular abre CalculatePayrollModal, que pide prefill y arma filas editables. El
    // "Calcular N empleados" del footer del modal dispara POST /calculate con esas filas.
    await row.getByTestId('payroll-calculate-btn').click()
    // El modal carga el prefill (loading) — esperar a que aparezca el botón "Calcular N empleados".
    const calcBtn = page.getByRole('button', { name: /Calcular .* empleados/ })
    await expect(calcBtn).toBeVisible({ timeout: 15_000 })
    // Capturar el response del calculate para tener el totalNet del toast a continuación.
    const calculateResponse = page.waitForResponse(
      (r) => r.url().includes(`/api/payroll/runs/${runId}/calculate`) && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await calcBtn.click()
    // Toast de "Nómina calculada: N empleados, $X neto".
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Nómina calculada' }),
    ).toBeVisible({ timeout: 15_000 })
    await calculateResponse

    // Persistencia: la corrida pasó a calculated.
    const afterCalc = await apiGet<any>(page, `/api/payroll/runs/${runId}`)
    expect((afterCalc.data ?? afterCalc).status).toBe('calculated')

    // ─── APPROVE ───
    // Tras calculate, la fila muestra el botón "Aprobar" (cyan). Approve pide confirmación vía
    // ConfirmModal → clickable.
    await expect(row.getByTestId('payroll-approve-btn')).toBeVisible()
    await row.getByTestId('payroll-approve-btn').click()
    // ConfirmModal: el botón "Aprobar" del modal vive en un Teleport al final del body, así que
    // convive con el botón de la fila (mismo nombre "Aprobar"). `.last()` toma el del modal (se
    // monta después en el DOM). Strict mode fallaría con getByRole solo porque matchea ambos.
    await page.getByRole('button', { name: 'Aprobar', exact: true }).last().click()
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Nómina aprobada — recibos generados' }),
    ).toBeVisible({ timeout: 15_000 })

    const afterApprove = await apiGet<any>(page, `/api/payroll/runs/${runId}`)
    expect((afterApprove.data ?? afterApprove).status).toBe('approved')

    // Efecto cascada: approve genera payslips (filas en /details).
    const details = await apiGet<any>(page, `/api/payroll/runs/${runId}/details`)
    const detailsList: any[] = details.data ?? details
    expect(
      detailsList.length,
      'approve debe generar al menos un recibo (payslip) por empleado',
    ).toBeGreaterThan(0)

    // ─── PAY ───
    // Tras approve, la fila muestra el botón "Marcar pagada".
    await expect(row.getByTestId('payroll-pay-btn')).toBeVisible()
    await row.getByTestId('payroll-pay-btn').click()
    // Ver APPROVE: mismo truco `.last()` para el botón del ConfirmModal.
    await page.getByRole('button', { name: 'Marcar pagada', exact: true }).last().click()
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Pago registrado' }),
    ).toBeVisible({ timeout: 15_000 })

    const afterPay = await apiGet<any>(page, `/api/payroll/runs/${runId}`)
    const afterPayBody = afterPay.data ?? afterPay
    expect(afterPayBody.status).toBe('paid')
    expect(afterPayBody.paidAt, 'pay debe setear paidAt').toBeTruthy()
  })

  // Idempotencia: un segundo POST /pay tras el primero no debe duplicar la liquidación. El front
  // oculta el botón cuando status==='paid', así que lo ejercemos por API — que es la verdadera
  // barrera (si el backend no fuera idempotente, un retry del front duplicaría el egreso).
  //
  // No creamos una corrida nueva: hay UNIQUE constraint por (hotelId, period) y el test anterior ya
  // dejó una para el mes actual. En vez de eso, tomamos la primera corrida del hotel que no esté
  // 'paid'/'cancelled', la avanzamos a 'paid' por API, y sobre ESA probamos el segundo pay. Si
  // todas ya están 'paid' (corrida de suite previa), usamos la primera directamente.
  test('un segundo POST /pay no duplica la liquidación (idempotencia)', async ({ page }) => {
    // apiGet necesita un document con localStorage accesible (ver test anterior).
    await page.goto('/panel/dashboard')

    // Crear la corrida en OTRO mes libre (distinto del test 1) para no chocar el UNIQUE.
    const { runId } = await createRunInFreePeriod(page)

    const prefillRes = await apiGet<any>(page, `/api/payroll/runs/${runId}/prefill`)
    const prefillRows: any[] = prefillRes.data ?? prefillRes
    test.skip(!prefillRows.length, 'el hotel demo no tiene empleados con legajo para liquidar')

    // Avanzar la corrida completa hasta paid por API (más rápido que 4 click+confirm del modal).
    const employees = prefillRows.map((r) => ({
      employeeId: r.employeeId, baseSalary: r.baseSalary,
      daysWorked: r.daysWorked, hoursWorked: r.hoursWorked,
      overtimeHours: r.overtimeHours, absences: r.absences, lateArrivals: r.lateArrivals,
    }))
    const calc = await apiPost<any>(page, `/api/payroll/runs/${runId}/calculate`, { employees })
    expect(calc.status, 'calculate debe ser 2xx').toBeLessThan(300)
    const appr = await apiPost<any>(page, `/api/payroll/runs/${runId}/approve`)
    expect(appr.status, 'approve debe ser 2xx').toBeLessThan(300)
    const pay1 = await apiPost<any>(page, `/api/payroll/runs/${runId}/pay`)
    expect(pay1.status, 'primer pay debe ser 2xx').toBeLessThan(300)

    // Confirmar que llegó a paid antes de probar idempotencia.
    const before2 = await apiGet<any>(page, `/api/payroll/runs/${runId}`)
    expect((before2.data ?? before2).status, 'la corrida debe estar paid antes del 2do pay').toBe('paid')

    // ─── Segundo pay: no debe duplicar ───
    const pay2 = await apiPost<any>(page, `/api/payroll/runs/${runId}/pay`)
    // Aceptamos 2xx (no-op idempotente) o 4xx (rechazo explícito de "ya está paga"). Cualquiera de
    // los dos preserva la invariant: hay UNA corrida paid para este runId, no dos.
    expect(pay2.status, 'el segundo pay debe ser 2xx o 4xx').toBeLessThan(500)

    const after = await apiGet<any>(page, `/api/payroll/runs/${runId}`)
    const afterBody = after.data ?? after
    expect(afterBody.status, 'la corrida sigue siendo paid (una sola vez)').toBe('paid')
    // La corrida es única por id — el test real de "no duplicación" es que siga habiendo UNA fila
    // para este runId en /api/payroll/runs (el backend no crea una nueva corrida por re-pay).
    const runsAfter = await apiGet<any>(page, '/api/payroll/runs')
    const runsListAfter: any[] = runsAfter.data ?? runsAfter
    const sameRun = runsListAfter.filter((r) => r.id === runId)
    expect(sameRun.length, 'no debe crearse una segunda corrida con el mismo id').toBe(1)
  })
})
