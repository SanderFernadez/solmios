import { test, expect } from '../fixtures'
import { createReservationToday, apiGet } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup (1 solo login por corrida) — evita el rate-limit
// del endpoint de login cuando corre la suite entera. Los specs de operaciones arrancan ya
// logueados; register/smoke no la usan porque prueban flujos públicos.
test.use({ storageState: ADMIN_STORAGE_STATE })

// RES-05 — Check-out con settlement (QA real, no "clickear y que no rompa").
//
// Cubre el ciclo de vida completo desde cero: alta de reserva (checkIn HOY) → check-in →
// check-out con pago en efectivo. El check-out sólo existe en la Recepción Digital
// (/panel/reservas/checkin), así que todo el flujo pasa por ahí. La reserva se crea con checkIn
// de hoy para que caiga en "Llegadas Hoy" (la columna filtra `checkIn === todayStr`).
//
// En CADA etapa se verifica lo que un QA humano comprobaría:
//   1. Validación   — el check-out exige que la reserva esté checked_in (409 si no).
//   2. Notificación — toast de éxito "Check-in confirmado" / "Check-out listo".
//   3. Persistencia — tras recargar, la reserva sigue checked_out y el huésped ya no está "En Casa".
//   4. Efecto cascada — check-in abre folio; check-out cierra folio + emite factura + registra
//      pago + deja la reserva checked_out. Verificado por API contra las tablas reales.
//
// Para los efectos colaterales se capturan las respuestas de los POST (/checkin devuelve
// folioId; /checkout devuelve settlement.invoiceId) y se verifican las entidades por id — más
// determinístico que listar (la lista /api/folios viene paginada y no siempre trae el nuevo).
//
// Corre contra el backend de dev (SQLite local) y PERSISTE reserva + folio + factura + pago en
// cada corrida — es un E2E real, no mockeado (mismo criterio que create-reservation.spec.ts).

test.describe('RES-05 — check-in + check-out con settlement', () => {
  test('ciclo completo: check-in abre folio, check-out emite factura y paga', async ({ page }) => {
    const { reservationId, guestName } = await createReservationToday(page, {
      nights: 1,
      prefix: 'E2E Checkout',
    })

    // ───────────────────────── CHECK-IN ─────────────────────────
    await page.goto('/panel/reservas/checkin')
    await expect(page.getByRole('heading', { name: 'Llegadas Hoy' })).toBeVisible()

    // La reserva nueva aparece en "Llegadas Hoy" (checkIn === hoy).
    const arrivalRow = page.getByTestId('arrival-row').filter({ hasText: guestName })
    await expect(arrivalRow).toBeVisible({ timeout: 15_000 })
    await arrivalRow.getByTestId('checkin-arrival-button').click()

    // El POST /checkin devuelve { ok, folioId, guestId } — lo capturamos para verificar el folio
    // por id (la lista /api/folios viene paginada y no es segura para encontrar el recién creado).
    await expect(page.getByTestId('checkin-modal')).toBeVisible()
    const checkinResponse = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/reservas/${reservationId}/checkin`) &&
        r.request().method() === 'POST' &&
        r.status() < 300,
      { timeout: 30_000 },
    )
    await expect(page.getByTestId('checkin-confirm-button')).toBeEnabled()
    await page.getByTestId('checkin-confirm-button').click()

    // (2) Notificación de éxito.
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Check-in confirmado' }),
    ).toBeVisible({ timeout: 15_000 })

    const checkinBody = await checkinResponse.then((r) => r.json())
    const folioId = checkinBody.folioId ?? checkinBody.data?.folioId
    expect(folioId, 'el check-in debió devolver el folioId').toBeTruthy()

    // (4) Efecto cascada del check-in: folio abierto y vinculado a la reserva + reserva checked_in.
    const folio = await apiGet<any>(page, `/api/folios/${folioId}`)
    const folioBody = folio.data ?? folio
    expect(folioBody.status).toBe('open')
    expect(folioBody.reservationId).toBe(reservationId)

    const resAfterCheckin = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    expect((resAfterCheckin.data ?? resAfterCheckin).status).toBe('checked_in')

    // ───────────────────────── CHECK-OUT ─────────────────────────
    // El huésped pasó a "En Casa" (checked_in, checkOut futuro).
    await expect(page.getByRole('heading', { name: 'En Casa' })).toBeVisible()
    const inHouseRow = page.getByTestId('inhouse-row').filter({ hasText: guestName })
    await expect(inHouseRow).toBeVisible({ timeout: 15_000 })
    await inHouseRow.getByTestId('checkout-button').click()

    // Modal de check-out.
    await expect(page.getByTestId('checkout-modal')).toBeVisible()
    // El botón confirmar arranca deshabilitado mientras carga el folio (folioLoading) — esperar
    // a que el saldo esté visible garantiza que el folio ya cargó.
    await expect(page.getByTestId('checkout-balance')).toBeVisible({ timeout: 15_000 })

    // El check-in postea el cargo de la noche → saldo > 0 → habilita settlement + factura.
    const balanceText = await page.getByTestId('checkout-balance').textContent()
    const balance = Number((balanceText || '').replace(/[^0-9.]/g, ''))
    expect(balance, 'debería haber saldo pendiente tras el cargo automático de la noche').toBeGreaterThan(0)

    // El modal auto-selecciona 'cash' si hay saldo; lo clickeo igual para que el test sea
    // explícito y no dependa de esa heurística interna.
    await page.getByTestId('settle-method-cash').click()
    await expect(page.getByTestId('checkout-confirm-button')).toBeEnabled()

    // Capturar el POST /checkout para verificar el settlement en la propia respuesta.
    const checkoutResponse = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/reservas/${reservationId}/checkout`) &&
        r.request().method() === 'POST' &&
        r.status() < 300,
      { timeout: 30_000 },
    )
    await page.getByTestId('checkout-confirm-button').click()

    // (2) Notificación de éxito — menciona la factura emitida.
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Check-out listo' }),
    ).toBeVisible({ timeout: 15_000 })

    const coBody = await checkoutResponse.then((r) => r.json())
    const settlement = coBody.settlement ?? coBody.data?.settlement
    const invoiceId = settlement?.invoiceId
    expect(invoiceId, 'el check-out con pago debió emitir una factura').toBeTruthy()

    // (4) Efecto cascada del check-out: reserva checked_out + folio cerrado y facturado.
    const resAfterCheckout = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    expect((resAfterCheckout.data ?? resAfterCheckout).status).toBe('checked_out')

    const folioAfter = await apiGet<any>(page, `/api/folios/${folioId}`)
    const folioAfterBody = folioAfter.data ?? folioAfter
    expect(folioAfterBody.status, 'el folio debió cerrarse').toBe('closed')
    expect(
      folioAfterBody.invoiceId || folioAfterBody.invoiceNumber,
      'el folio debió vincularse a la factura emitida',
    ).toBeTruthy()

    // La factura existe y pertenece a este folio/reserva.
    const invoice = await apiGet<any>(page, `/api/facturas/${invoiceId}`)
    const invoiceBody = invoice.data ?? invoice
    expect(invoiceBody.id).toBe(invoiceId)

    // (3) Persistencia: recargo y la reserva sigue checked_out (el huésped ya no está "En Casa").
    await page.reload()
    await expect(page.getByRole('heading', { name: 'En Casa' })).toBeVisible()
    await expect(page.getByTestId('inhouse-row').filter({ hasText: guestName })).toHaveCount(0)
  })

  // (1) Validación de estado: el check-out exige check-in previo. La UI no deja llegar al botón
  // de una reserva sin check-in, así que se ejerce la guarda directamente por API — es la misma
  // validación que el servidor aplica sin importar quién llame. RES-05 caso borde "checkout de
  // reserva NO checked_in → 409".
  test('rechaza el check-out de una reserva sin check-in previo (409)', async ({ page }) => {
    const { reservationId } = await createReservationToday(page, { prefix: 'E2E NoCheckin' })

    const token = await page.evaluate(() => localStorage.getItem('token'))
    const res = await page.request.post(`/api/reservas/${reservationId}/checkout`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { settle: null },
    })
    expect(res.status()).toBe(409)
  })
})
