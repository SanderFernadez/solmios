import { test, expect } from '../fixtures'
import { createReservationToday, apiGet } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// RES-03 — Cancelar reserva con política (QA real).
//
// Cancelar es irreversible y mueve plata (fee/refund + depósito), por eso siempre pasa por un
// modal con preview de la política (GET /cancel-preview) y motivo obligatorio. Este spec verifica
// lo que un QA humano comprobaría:
//   1. Validación — el botón "Cancelar reserva" está deshabilitado sin motivo; y cancelar una
//      reserva con check-in es rechazado (409 — hay que hacer check-out, no cancelar).
//   2. Notificación — toast "Reserva cancelada".
//   3. Persistencia — tras recargar, el botón cancelar de esa fila desaparece (ya está cancelada).
//   4. Efecto cascada — la reserva queda `cancelled` con el motivo persistido y refundAmount >= 0.
//
// El preview (cancel-fee / cancel-refund) es solo COTIZACIÓN: el monto real lo aplica el servidor
// en el POST /cancel y es el que devuelve (puede diferir si se cruza un borde de tier). No se
// puede cancelar por el CRUD viejo (PUT status:cancelled) — el backend lo bloquea con 409; el
// único camino que aplica la política es POST /reservas/:id/cancel.

test.describe('RES-03 — cancelar reserva', () => {
  test('cancela aplicando la política y persiste el motivo', async ({ page }) => {
    const { reservationId, guestName } = await createReservationToday(page, {
      nights: 1,
      prefix: 'E2E Cancelar',
    })

    await page.goto('/panel/reservas')
    await expect(page.getByRole('heading', { name: 'Listado de reservas' })).toBeVisible()

    const row = page.getByTestId('reservation-row').filter({ hasText: guestName })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByTestId('reservation-row-cancel').click()

    // El modal carga el preview de la política (cancel-loading → cancel-preview).
    await expect(page.getByTestId('cancel-preview')).toBeVisible({ timeout: 15_000 })

    // (1) Validación: sin motivo el botón de confirmar está deshabilitado.
    const confirmBtn = page.getByTestId('cancel-confirm-button')
    await expect(confirmBtn).toBeDisabled()
    await page.getByTestId('cancel-reason-select').selectOption('guest_request')
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()

    // (2) Notificación de éxito.
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Reserva cancelada' }),
    ).toBeVisible({ timeout: 15_000 })

    // (4) Efecto cascada: status cancelled + motivo persistido + refund >= 0.
    const resAfter = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    const body = resAfter.data ?? resAfter
    expect(body.status).toBe('cancelled')
    expect(body.cancellationReason, 'el motivo debió persistir').toBeTruthy()
    expect(Number(body.refundAmount ?? 0)).toBeGreaterThanOrEqual(0)

    // (3) Persistencia: recargo y el botón cancelar ya no está (la reserva está cancelada).
    await page.reload()
    await expect(
      page
        .getByTestId('reservation-row')
        .filter({ hasText: guestName })
        .getByTestId('reservation-row-cancel'),
    ).toHaveCount(0)
  })

  // (1) Validación: el confirmar exige motivo explícito (cubre doble-submit / atajos que pierdan
  // el disabled).
  test('no habilita confirmar sin elegir motivo', async ({ page }) => {
    const { guestName } = await createReservationToday(page, { prefix: 'E2E SinMotivo' })

    await page.goto('/panel/reservas')
    const row = page.getByTestId('reservation-row').filter({ hasText: guestName })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByTestId('reservation-row-cancel').click()
    await expect(page.getByTestId('cancel-preview')).toBeVisible({ timeout: 15_000 })

    await expect(page.getByTestId('cancel-confirm-button')).toBeDisabled()
  })

  // (1) Validación de estado: cancelar una reserva con check-in es 409 (hay que hacer check-out).
  // La UI lista no ofrece el botón para checked_in, así que se ejerce la guarda por API.
  test('rechaza cancelar una reserva con check-in (409)', async ({ page }) => {
    const { reservationId } = await createReservationToday(page, { prefix: 'E2E CancelCI' })
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const headers = { Authorization: `Bearer ${token}` }

    const checkin = await page.request.post(`/api/reservas/${reservationId}/checkin`, { headers, data: {} })
    expect(checkin.status()).toBe(200)

    const cancel = await page.request.post(`/api/reservas/${reservationId}/cancel`, { headers, data: {} })
    expect(cancel.status()).toBe(409)
  })
})
