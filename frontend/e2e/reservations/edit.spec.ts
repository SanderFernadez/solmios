import { test, expect } from '../fixtures'
import { createReservationToday, apiGet, apiPost, freeRoomForStay } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Helper PUT autenticado (mismo contexto/token que apiPost). El helper reservation-flow no exporta
// apiPut — lo definimos localmente porque el endpoint de update de reserva es PUT /api/reservas/:id.
async function apiPut<T = any>(
  page: import('@playwright/test').Page,
  path: string,
  body: unknown = {},
): Promise<{ status: number; body: T }> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const res = await page.request.put(path, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body,
  })
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as T }
}

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// RES-02 — Edición de reserva (wizard modo edición).
//
// Cubre:
//   - Happy path: abrir el wizard en modo edición desde el menú ⋮ de la fila ("Editar"), cambiar
//     el campo `adults` del paso 4, guardar y verificar que el cambio persistió por API.
//   - IDOR hotelId: el wizard NUNCA envía hotelId en el payload de update (es del token). Un PUT
//     manual con hotelId ajeno en el body no debe cambiar la reserva de hotel.
//   - Solape (409): dos reservas en la misma habitación; editar una para solapar la otra debe
//     fallar con 409. Se ejerce por API porque la UI (wizard-error) depende del flujo completo de
//     5 pasos y es frágil de automatizar para cada intento.
//
// El cambio de adults es seguro: no recalcula precio (va aparte) ni choca con disponibilidad, así
// que aísla el efecto "edición persiste" del efecto "edición revalida disponibilidad".

test.describe('RES-02 — edición de reserva', () => {
  test('cambia adults desde el wizard y el cambio persiste', async ({ page }) => {
    const { reservationId } = await createReservationToday(page, {
      nights: 2,
      prefix: 'E2E Edit',
    })

    // Traer la reserva para saber el adults inicial y afirmar que realmente cambió.
    const before = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    const beforeBody = before.data ?? before
    const adultsBefore = Number(beforeBody.adults) || 1
    const adultsAfter = adultsBefore + 1

    await page.goto('/panel/reservas')
    await expect(page.getByRole('heading', { name: 'Listado de reservas' })).toBeVisible()
    // Limpiar los filtros para que la reserva nueva aparezca sin depender del estado que dejó
    // otro test (search/filterStatus se persisten en el componente, no en localStorage, pero el
    // contexto de la corrida anterior puede dejar cosas raras).
    const row = page.locator(`[data-res-id="${reservationId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // Abrir el menú contextual (⋮) y clickear "Editar". El menú se cierra solo (openMenuId='').
    await row.locator('button').filter({ hasText: '⋮' }).click()
    await page.getByTestId('reservation-row-edit').click()

    // El wizard abre en paso 1; el adults vive en el paso 4 (Alojamiento).
    await expect(page.getByTestId('wizard-title')).toHaveText('Editar Reserva')
    // Avanzar paso a paso (3 clicks "Siguiente"). Entre paso y paso esperamos al texto del step
    // para no enviar el siguiente click antes de que termine la transición (CI se vio perder el
    // click si se hace muy seguido). El timeout default de expect (5s) a veces no alcanza para la
    // transición → usamos 15s explícito.
    await page.getByRole('button', { name: 'Siguiente' }).click() // 1 → 2
    await expect(page.getByText('Paso 2 de 5')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Siguiente' }).click() // 2 → 3
    await expect(page.getByText('Paso 3 de 5')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Siguiente' }).click() // 3 → 4
    await expect(page.getByText('Paso 4 de 5')).toBeVisible({ timeout: 15_000 })

    // Cambiar adults. fill() reemplaza el valor existente.
    await page.locator('#wiz-adults').fill(String(adultsAfter))

    // Capturar el PUT /api/reservas/:id para confirmar 2xx (alternativa a esperar el toast, más
    // determinístico para afirmar que el update viajó).
    const updateResponse = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/reservas/${reservationId}`) &&
        r.request().method() === 'PUT' &&
        r.status() < 300,
      { timeout: 30_000 },
    )
    // Ir al paso 5 y guardar.
    await page.getByRole('button', { name: 'Siguiente' }).click() // 4 → 5
    await expect(page.getByText('Paso 5 de 5')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('wizard-submit-btn').click()

    // Toast éxito (mismo texto que en el código del wizard: "Reserva actualizada").
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Reserva actualizada' }),
    ).toBeVisible({ timeout: 15_000 })
    await updateResponse

    // Persistencia: GET por id confirma que el adults nuevo quedó guardado.
    const after = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    expect(Number((after.data ?? after).adults)).toBe(adultsAfter)
  })

  // IDOR hotelId: el wizard no manda hotelId en el payload de update, pero un atacante con el id de
  // otra reserva podría intentar mandarlo en el body. El backend debe ignorar/rechazar el cambio de
  // hotel: la reserva NO se muda de hotel. Verificamos que hotelId sigue siendo el original.
  test('PUT con hotelId ajeno no mueve la reserva de hotel (IDOR)', async ({ page }) => {
    const { reservationId } = await createReservationToday(page, { prefix: 'E2E IDOR' })

    const before = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    const originalHotelId = (before.data ?? before).hotelId
    expect(originalHotelId, 'la reserva debe tener hotelId').toBeTruthy()

    // "hotelId ajeno": un id inventado con formato UUID. El backend debe no hacer case a este campo
    // en el update (lo toma del token) o rechazarlo; cualquiera de los dos resultados deja a la
    // reserva en su hotel original.
    const fakeHotelId = '00000000-0000-4000-8000-000000000000'
    const update = await apiPut<any>(page, `/api/reservas/${reservationId}`, {
      hotelId: fakeHotelId,
      adults: 3,
    })

    // Aceptamos tanto 2xx (ignoró hotelId) como 4xx (rechazó el cambio). Lo que NO puede pasar es
    // 2xx + hotelId cambiado (eso sería el IDOR exitoso).
    expect(update.status, 'el PUT debe responder 2xx o 4xx').toBeLessThan(500)

    const after = await apiGet<any>(page, `/api/reservas/${reservationId}`)
    expect((after.data ?? after).hotelId, 'hotelId no debe cambiar').toBe(originalHotelId)
  })

  // Solape (409): la reserva A ocupa [hoy, hoy+2). La reserva B ocupa [hoy+5, hoy+7). Editar A para
  // que termine en hoy+6 solapa con B → el backend debe rechazar con 409. Lo ejercemos por API: la
  // UI mostraría el wizard-error, pero llegar hasta el paso 5 dos veces para repro el solape es
  // frágil (y el endpoint que el botón invoca es el mismo PUT /api/reservas/:id).
  test('editar para solapar otra reserva se rechaza con 409', async ({ page }) => {
    const a = await createReservationToday(page, { nights: 2, prefix: 'E2E Solapa A' })
    // La reserva B se crea por API para no depender de una segunda vuelta completa del wizard (que
    // además puede topar el problema de "no hay habitación libre" en el hotel demo). La creamos en
    // otra habitación pero vamos a MOVER la A a esa misma habitación+ventana para forzar el solape.
    // Para garantizar habitación, primero conseguimos una libre en [hoy+5, hoy+7).
    const todayPlus5 = new Date()
    todayPlus5.setDate(todayPlus5.getDate() + 5)
    const todayPlus7 = new Date()
    todayPlus7.setDate(todayPlus7.getDate() + 7)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const checkInB = iso(todayPlus5)
    const checkOutB = iso(todayPlus7)

    // Mismo problema que `createReservationToday`: la ventana hoy+5→hoy+7 es fija y, tras muchas
    // corridas de la suite sobre el hotel demo (8 habitaciones), termina sin nada libre para ese
    // rango exacto. Liberamos igual que el resto del helper antes de pedir disponibilidad.
    await freeRoomForStay(page, checkInB, checkOutB)
    const roomsRes = await apiGet<any>(page, `/api/habitaciones?checkIn=${checkInB}&checkOut=${checkOutB}`)
    const roomsList: any[] = roomsRes.data ?? roomsRes
    const roomB = roomsList.find((r) => r.available)
    expect(roomB, `debe haber habitación libre para ${checkInB}→${checkOutB}`).toBeTruthy()

    // HotelId del token se lee del localStorage (mismo lugar que el helper apiGet) — sin llamada
    // extra a /api/auth/me, que contribuye a topar el rate-limit por IP en suite larga.
    const hotelId = await page.evaluate(() => {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      return u.hotelId
    })
    expect(hotelId, 'el admin debe tener hotelId en localStorage').toBeTruthy()

    // Crear B por API: misma habitación, ventana [hoy+5, hoy+7). hotelId SÍ se pasa (el endpoint de
    // reservas lo exige en el body, a diferencia de otros que lo toman solo del token).
    const createB = await apiPost<any>(page, '/api/reservas', {
      hotelId,
      roomId: roomB.id,
      guestName: `E2E Solapa B ${Date.now()}`,
      email: `e2e.solapa.b.${Date.now()}@example.com`,
      checkIn: checkInB, checkOut: checkOutB,
      adults: 2, children: 0,
      source: 'direct', status: 'confirmed',
      totalAmount: 100, paymentMethod: 'cash',
    })
    expect(createB.status, 'la reserva B debe crearse').toBeLessThan(300)

    // Mover A a la ventana de B (solapando). checkOut de A pasa a hoy+6 (cae dentro de B).
    const todayPlus6 = new Date()
    todayPlus6.setDate(todayPlus6.getDate() + 6)
    const overlap = await apiPut<any>(page, `/api/reservas/${a.reservationId}`, {
      roomId: roomB.id,
      checkIn: checkInB,
      checkOut: iso(todayPlus6), // solapa con B (que termina hoy+7)
    })

    // El backend debe rechazar con 409 (solape) — no 500, no 2xx silencioso.
    expect(
      overlap.status,
      `el solape debe rechazarse con 409 (vió ${overlap.status}: ${JSON.stringify(overlap.body).slice(0, 120)})`,
    ).toBe(409)
  })
})
