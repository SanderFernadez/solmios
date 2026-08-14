import { test, expect } from '../fixtures'
import { createReservationToday, apiGet } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// DEV-01 — Ciclo completo de la cerradura DESDE el detalle de la reserva (habitación con cerradura).
//
// Precondición de dev: la habitación 103 (room-0003) tiene la cerradura "E2E Cerradura Test"
// insertada en la SQLite con status 'offline' — así `generateCode` registra el PIN como 'pending'
// SIN tocar hardware TTLock real (ver generateCodeForReservation: offline → no llama a la API).
// Con la cerradura online y TTLock sin conectar, el mismo flujo fallaría con "TTLock no conectado".
//
// Cubre lo que pidió el dueño: en la vista de la reserva, VER la sección cerradura, CREAR el
// código manual, y que el cambio persista (API) y se vea en el modal (UI).

test.describe('cerradura en el detalle de reserva (hab 103)', () => {
  test('crear código manual desde el detalle y verlo persistido', async ({ page }) => {
    const pin = String(100000 + Math.floor(Math.random() * 899999))
    const { reservationId, guestName } = await createReservationToday(page, {
      nights: 1,
      prefix: 'E2E Hab103',
      roomNumber: '103',
    })

    // Abrir el detalle de la reserva desde la lista (click en la fila).
    await page.goto('/panel/reservas')
    const row = page.getByTestId('reservation-row').filter({ hasText: guestName })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.locator('td').first().click()

    // La sección Cerradura aparece (habitación CON cerradura, sin código → card de generación).
    await expect(page.getByText('Cerradura', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('lock-manual-toggle').first().click()
    await page.getByTestId('lock-manual-input').first().fill(pin)
    await page.getByTestId('lock-manual-create').first().click()

    // (2) Notificación + (3) el código queda visible en el modal.
    await expect(page.getByTestId('toast-success').filter({ hasText: 'Código creado' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('lock-code').first()).toHaveText(pin)

    // (4) Persistencia vía API: la fila existe, vinculada a la reserva, pending (offline, sin hardware).
    // /api/ttlock/codes responde con doble envoltura: { success, data: { data: [...] } }.
    const codes = await apiGet<any>(page, '/api/ttlock/codes')
    const list: any[] = codes.data?.data ?? codes.data ?? codes
    const saved = list.find((c: any) => c.reservationId === reservationId && c.code === pin)
    expect(saved, 'el código manual debió persistir vinculado a la reserva').toBeTruthy()
    expect(['active', 'pending']).toContain(saved.status)
  })

  // Regla de negocio (regresión): una reserva = UN código vigente. Regenerar/crear manual cuando
  // ya hay uno REVOCa el anterior (PIN físico incluido) — antes quedaban dos activos y el huésped
  // recibía dos códigos distintos (confuso y peligroso: ambos abrían la puerta).
  test('regenerar no duplica: queda UN solo código vigente', async ({ page }) => {
    const pin1 = String(100000 + Math.floor(Math.random() * 899999))
    const pin2 = String(100000 + Math.floor(Math.random() * 899999))
    const { reservationId, guestName } = await createReservationToday(page, {
      prefix: 'E2E UnCodigo',
      roomNumber: '103',
    })

    await page.goto('/panel/reservas')
    const row = page.getByTestId('reservation-row').filter({ hasText: guestName })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.locator('td').first().click()
    await expect(page.getByText('Cerradura', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    // Primer código manual.
    await page.getByTestId('lock-manual-toggle').first().click()
    await page.getByTestId('lock-manual-input').first().fill(pin1)
    await page.getByTestId('lock-manual-create').first().click()
    await expect(page.getByTestId('toast-success').filter({ hasText: 'Código creado' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('lock-code').first()).toHaveText(pin1)

    // Segundo código manual (reemplaza al primero).
    await page.getByTestId('lock-manual-toggle').first().click()
    await page.getByTestId('lock-manual-input').first().fill(pin2)
    await page.getByTestId('lock-manual-create').first().click()
    await expect(page.getByTestId('toast-success').filter({ hasText: 'Código creado' })).toBeVisible({ timeout: 15_000 })

    // (4) Vía API: exactamente UN vigente (el nuevo), el anterior revoked.
    const codes = await apiGet<any>(page, '/api/ttlock/codes')
    const list: any[] = codes.data?.data ?? codes.data ?? codes
    const vivos = list.filter((c: any) => c.reservationId === reservationId && ['active', 'pending'].includes(c.status))
    expect(vivos.length, 'debe quedar exactamente UN código vigente').toBe(1)
    expect(vivos[0].code).toBe(pin2)
    const viejo = list.find((c: any) => c.reservationId === reservationId && c.code === pin1)
    expect(viejo?.status, 'el código anterior debió quedar revocado').toBe('revoked')
  })
})
