import { test, expect } from '../fixtures'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup (1 solo login por corrida) — evita el rate-limit
// del login cuando corre la suite entera. Mismo patrón que checkout.spec.ts.
test.use({ storageState: ADMIN_STORAGE_STATE })

// Flujo completo de usuario: login real (no fixture con token falso) + alta de una reserva
// nueva desde /panel/reservas (ReservationWizardModal, wizard de 5 pasos: Huésped → Detalles
// → Emergencia → Alojamiento → Pago). Solo se completan los campos OBLIGATORIOS de cada paso
// (ver isStep1Valid/isStep4Valid en el componente) — Detalles y Emergencia son 100% opcionales
// y se saltean con "Siguiente".
//
// Corre contra el backend real de dev (SQLite local) y PERSISTE huésped + reserva en cada
// corrida — mismo criterio que e2e/auth/register.spec.ts (E2E real, no mockeado).
//
// La sesión admin la provee globalSetup (storageState, ver test.use arriba) — ya no loguea por UI.

function uniqueGuestName(): string {
  return `E2E Huesped ${Date.now()}`
}

// Ventana de 2 noches en un offset ALEATORIO lejos de "hoy" (30-330 días). Aleatorio y no fijo:
// con un offset fijo, cada corrida del mismo día pelea por el mismo par de fechas que ya ocupó
// la corrida anterior — con solo 8 habitaciones sembradas, a la 9na corrida del día ya no queda
// ninguna libre para ese rango exacto y el alta falla con 409 (verificado: pasó en esta sesión).
function randomFutureStay(): { checkIn: string; checkOut: string } {
  const start = 30 + Math.floor(Math.random() * 300)
  const toISO = (daysFromNow: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    return d.toISOString().slice(0, 10)
  }
  return { checkIn: toISO(start), checkOut: toISO(start + 2) }
}

test.describe('reservas — flujo completo', () => {
  test('crear reserva para un huésped nuevo', async ({ page }) => {
    const guestName = uniqueGuestName()
    const guestEmail = `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`

    await page.goto('/panel/reservas')
    // Esperar a que la lista terminó de cargar (evita clickear "Nueva Reserva" en medio de la
    // navegación post-login + el goto, que en CI se vio perder el click alguna vez).
    await expect(page.getByRole('heading', { name: 'Listado de reservas' })).toBeVisible()
    await page.getByTestId('reservations-new-button').click()
    await expect(page.getByTestId('wizard-title')).toHaveText('Nueva Reserva')

    // — Paso 1: Huésped — estos campos ya traían `id` propio en el componente (wiz-name,
    // wiz-email...), así que se targetean por ahí en vez de sumar data-testid redundante.
    await page.locator('#wiz-name').fill(guestName)
    await page.locator('#wiz-email').fill(guestEmail)
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // — Paso 2: Detalles — sin campos obligatorios, se saltea.
    await expect(page.getByText('Paso 2 de 5')).toBeVisible()
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // — Paso 3: Emergencia — sin campos obligatorios, se saltea.
    await expect(page.getByText('Paso 3 de 5')).toBeVisible()
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // — Paso 4: Alojamiento —
    await expect(page.getByText('Paso 4 de 5')).toBeVisible()
    const stay = randomFutureStay()
    // Debounce de 300ms en el componente (refreshRoomsAvailability, ver ReservationWizardModal.vue)
    // antes de pedir disponibilidad real por fecha — sin esperar la respuesta, el selector todavía
    // muestra TODAS las habitaciones como disponibles (fallback a props.rooms sin anotar) y se
    // puede terminar eligiendo una que el backend rechaza con 409 (verificado: pasó en esta sesión).
    const availabilityLoaded = page.waitForResponse((r) =>
      r.url().includes('/api/habitaciones') && r.url().includes(`checkIn=${stay.checkIn}`))
    await page.locator('#wiz-checkin').fill(stay.checkIn)
    await page.locator('#wiz-checkout').fill(stay.checkOut)
    await availabilityLoaded

    const roomSelect = page.getByTestId('wiz-room-select')
    await roomSelect.locator('input').click()
    // Primera opción disponible (no deshabilitada) — cualquier habitación libre esas fechas sirve.
    const firstAvailableRoom = page.locator('body > ul li:not([aria-disabled="true"])').first()
    await expect(firstAvailableRoom).toBeVisible()
    await firstAvailableRoom.click()
    await expect(roomSelect.locator('input')).not.toHaveValue('')

    await page.getByRole('button', { name: 'Siguiente' }).click()

    // — Paso 5: Pago — se deja todo con el valor por defecto.
    await expect(page.getByText('Paso 5 de 5')).toBeVisible()
    await page.getByRole('button', { name: 'Crear Reserva' }).click()

    // Sin error de validación/disponibilidad, y el modal se cierra solo — ver onWizardSaved()
    // en pages/reservations/index.vue (@saved cierra el wizard y recarga la lista).
    await expect(page.getByTestId('wizard-error')).not.toBeAttached()
    await expect(page.getByTestId('wizard-title')).not.toBeAttached({ timeout: 15_000 })

    // La reserva nueva aparece en la lista.
    await page.getByTestId('reservations-search').fill(guestName)
    await expect(page.getByTestId('reservation-guest-name').filter({ hasText: guestName })).toBeVisible()
  })
})
