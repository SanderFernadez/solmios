import { test, expect } from '../fixtures'
import { createReservationToday, apiGet } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// RES-04 — Check-in con cargo automático de habitación (QA real).
//
// El check-in hace TRES cosas atómicas (backend): transiciona la reserva a checked_in, abre un
// folio, y postea el cargo de la noche en ese folio (room charge). Este spec verifica las tres
// contra las tablas reales, no solo que "el modal se cerró". Cubre además la guarda de doble
// check-in (409) — un click doble o dos recepcionistas no deben duplicar el cargo.
//
// El check-in vive en la Recepción Digital (/panel/reservas/checkin), columna "Llegadas Hoy"
// (filtra `checkIn === todayStr`), por eso la reserva se crea con checkIn HOY.

test.describe('RES-04 — check-in + cargo automático', () => {
  test('el check-in abre folio y posta el cargo de la noche', async ({ page }) => {
    const { reservationId, guestName } = await createReservationToday(page, {
      nights: 1,
      prefix: 'E2E Checkin',
    })

    await page.goto('/panel/reservas/checkin')
    await expect(page.getByRole('heading', { name: 'Llegadas Hoy' })).toBeVisible()

    const arrivalRow = page.getByTestId('arrival-row').filter({ hasText: guestName })
    await expect(arrivalRow).toBeVisible({ timeout: 15_000 })
    await arrivalRow.getByTestId('checkin-arrival-button').click()

    // El POST /checkin devuelve { ok, folioId, guestId }.
    await expect(page.getByTestId('checkin-modal')).toBeVisible()
    const checkinResponse = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/reservas/${reservationId}/checkin`) &&
        r.request().method() === 'POST' &&
        r.status() < 300,
      { timeout: 30_000 },
    )
    await page.getByTestId('checkin-confirm-button').click()

    // (2) Notificación de éxito.
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Check-in confirmado' }),
    ).toBeVisible({ timeout: 15_000 })

    const checkinBody = await checkinResponse.then((r) => r.json())
    const folioId = checkinBody.folioId ?? checkinBody.data?.folioId
    expect(folioId, 'el check-in debió devolver el folioId').toBeTruthy()

    // (4) Efecto cascada: reserva checked_in + folio abierto CON el cargo automático de la noche.
    const folio = await apiGet<any>(page, `/api/folios/${folioId}`)
    const folioBody = folio.data ?? folio
    expect(folioBody.status).toBe('open')
    expect(folioBody.reservationId).toBe(reservationId)
    expect(folioBody.chargeCount, 'el check-in debió postear al menos 1 cargo (la noche)').toBeGreaterThanOrEqual(1)
    expect(folioBody.chargesTotal, 'el folio debió tener saldo por el cargo de la noche').toBeGreaterThan(0)

    const resAfter = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    expect((resAfter.data ?? resAfter).status).toBe('checked_in')

    // (3) Persistencia: recargo y el huésped ya no está en "Llegadas Hoy" (ahora está "En Casa").
    await page.reload()
    await expect(arrivalRow).toHaveCount(0)
  })

  // (1) Validación de estado: un segundo check-in sobre la misma reserva debe rechazarse (409),
  // sin duplicar cargos. La UI esconde el botón tras el primer check-in, así que se ejerce la
  // guarda por API (la misma que aplica el servidor sin importar el caller).
  test('rechaza el doble check-in (409, sin duplicar cargo)', async ({ page }) => {
    const { reservationId } = await createReservationToday(page, { prefix: 'E2E DobleCheckin' })
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const headers = { Authorization: `Bearer ${token}` }

    // Primer check-in: 200.
    const first = await page.request.post(`/api/reservas/${reservationId}/checkin`, { headers, data: {} })
    expect(first.status()).toBe(200)
    const firstBody = await first.json()
    const folioId = firstBody.folioId ?? firstBody.data?.folioId

    // Segundo check-in: 409 (AlreadyCheckedInError).
    const second = await page.request.post(`/api/reservas/${reservationId}/checkin`, { headers, data: {} })
    expect(second.status()).toBe(409)

    // El folio sigue con un solo cargo: el segundo intento NO agregó nada.
    const folio = await apiGet<any>(page, `/api/folios/${folioId}`)
    const folioBody = folio.data ?? folio
    expect(folioBody.chargeCount).toBe(1)
  })
})
