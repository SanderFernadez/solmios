import { test, expect } from '../fixtures'
import { createPendingInvoice, getInvoice, apiPost, apiGet } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// FAC-02 — Anular ≠ borrar (QA real).
//
// Una factura con efectos contables (cobrada, vencida, con pagos) NO se borra: se anula con nota
// de crédito. Borrar deja el libro de ventas sin respaldo y abre un hueco en el numerador. Cubre:
//   2. Notificación — toast "Nota de crédito emitida".
//   3. Persistencia — la original pasa a `cancelled` y existe una nueva fila `credit_note`.
//   1. Validación — DELETE sobre factura cobrada → 409 ConflictError (el backend lo impide).
//
// Setup: se crea la factura y se PAGA por API (para que tenga efectos → no deletable → aparece el
// botón "Anular", no el de "Eliminar").

test.describe('FAC-02 — anular con nota de crédito', () => {
  test('anula una factura cobrada y emite la nota de crédito', async ({ page }) => {
    const { invoiceId } = await createPendingInvoice(page)
    const invoice = await getInvoice(page, invoiceId)
    const balance = Number(invoice.balance)
    // Pagar para que tenga efectos contables → no deletable → se anula.
    const pay = await apiPost(page, `/api/facturas/${invoiceId}/pay`, { method: 'cash', amount: balance })
    expect(pay.status, 'el pago del setup debió ser 2xx').toBeLessThan(300)

    await page.goto('/panel/finanzas/facturacion')
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 })
    // La factura recién creada tiene el número más alto (la lista ordena ASC por número) → si hay
    // varias páginas, cae en la última. Navegar ahí antes de buscarla por id.
    const lastPage = page.getByRole('button', { name: '»' })
    if (await lastPage.isVisible().catch(() => false)) await lastPage.click()
    const row = page.locator(`[data-invoice-id="${invoiceId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // Botón "Anular con nota de crédito" (aparece porque está paid → no deletable).
    await row.getByTestId('invoice-credit-note-btn').click()
    await expect(page.getByTestId('credit-note-reason-input')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('credit-note-reason-input').fill('Anulación E2E — test de regresión')
    await page.getByTestId('credit-note-confirm-btn').click()

    // (2) Notificación de éxito.
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Nota de crédito emitida' }),
    ).toBeVisible({ timeout: 15_000 })

    // (3) Persistencia + efecto: original cancelled + existe nota de crédito.
    const after = await getInvoice(page, invoiceId)
    expect(after.status).toBe('cancelled')

    const notes = await apiGet<any>(page, '/api/facturas?type=credit_note&limit=200')
    const noteList: any[] = notes.data ?? notes
    expect(noteList.length, 'debe existir al menos una nota de crédito').toBeGreaterThan(0)
  })

  // (1) Validación: borrar una factura cobrada se rechaza (409). La UI no ofrece el botón de
  // borrado para facturas con efectos, así que se ejerce la guarda por API.
  test('DELETE sobre una factura cobrada es rechazado (409)', async ({ page }) => {
    const { invoiceId } = await createPendingInvoice(page)
    const invoice = await getInvoice(page, invoiceId)
    const balance = Number(invoice.balance)
    await apiPost(page, `/api/facturas/${invoiceId}/pay`, { method: 'cash', amount: balance })

    const token = await page.evaluate(() => localStorage.getItem('token'))
    const res = await page.request.delete(`/api/facturas/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(409)
  })
})
