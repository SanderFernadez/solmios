import { test, expect } from '../fixtures'
import { createPendingInvoice, getInvoice, apiGet } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// FAC-01 — Cobro de factura (QA real).
//
// Cubre el cobro total que salda la factura y la regresión del sobrepago (antes una factura no
// tenía tope y se podía "cobrar" de más; hoy el usecase rechaza amount > outstanding). Verifica:
//   2. Notificación — toast "Pago registrado".
//   3. Persistencia — la factura pasa a `paid` con balance 0.
//   4. Efecto cascada — aparece una fila en `payments` con status `completed` vinculada a la factura.
// Y para el sobrepago:
//   1. Validación — el backend rechaza (400) y el front lo refleja con toast-error; SIN side-effects
//      (la factura conserva su saldo y no se crea ningún pago).
//
// Setup: createPendingInvoice emite una factura `pending` con saldo vía folio→factura.

test.describe('FAC-01 — cobro de factura', () => {
  test('cobro total salda la factura y registra el pago', async ({ page }) => {
    const { invoiceId } = await createPendingInvoice(page)
    const invoice = await getInvoice(page, invoiceId)
    expect(invoice, 'la factura del setup debe existir').toBeTruthy()
    const balance = Number(invoice.balance)
    expect(balance, 'la factura debe tener saldo a cobrar').toBeGreaterThan(0)

    await page.goto('/panel/finanzas/facturacion')
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 })
    // La factura recién creada tiene el número más alto (la lista ordena ASC por número) → si hay
    // varias páginas, cae en la última. Navegar ahí antes de buscarla por id.
    const lastPage = page.getByRole('button', { name: '»' })
    if (await lastPage.isVisible().catch(() => false)) await lastPage.click()
    const row = page.locator(`[data-invoice-id="${invoiceId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByTestId('invoice-pay-btn').click()

    // El monto viene pre-lleno con el saldo; método cash explícito.
    await expect(page.getByTestId('pay-amount-input')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('pay-method-cash').click()
    await page.getByTestId('pay-confirm-btn').click()

    // (2) Notificación de éxito.
    await expect(
      page.getByTestId('toast-success').filter({ hasText: 'Pago registrado' }),
    ).toBeVisible({ timeout: 15_000 })

    // (3)+(4) Persistencia + efecto cascada: factura paid, balance 0, payment completed.
    const after = await getInvoice(page, invoiceId)
    expect(after.status).toBe('paid')
    expect(Number(after.balance)).toBe(0)

    const pays = await apiGet<any>(page, '/api/payments?limit=200')
    const payList: any[] = pays.data ?? pays
    const pay = payList.find((p) => p.invoiceId === invoiceId)
    expect(pay, 'debe existir un payment vinculado a la factura').toBeTruthy()
    expect(pay.status).toBe('completed')
  })

  // (1) Regresión: el sobrepago se rechaza sin tocar la factura ni crear pago. El front no bloquea
  // el monto (lo hace el backend) y muestra un toast-error genérico — el test documenta ese
  // comportamiento opaco.
  test('rechaza el sobrepago sin side-effects', async ({ page }) => {
    const { invoiceId } = await createPendingInvoice(page)
    const invoice = await getInvoice(page, invoiceId)
    const balance = Number(invoice.balance)
    const sobrepago = balance + 50

    await page.goto('/panel/finanzas/facturacion')
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 })
    // La factura recién creada tiene el número más alto (la lista ordena ASC por número) → si hay
    // varias páginas, cae en la última. Navegar ahí antes de buscarla por id.
    const lastPage = page.getByRole('button', { name: '»' })
    if (await lastPage.isVisible().catch(() => false)) await lastPage.click()
    const row = page.locator(`[data-invoice-id="${invoiceId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByTestId('invoice-pay-btn').click()

    await expect(page.getByTestId('pay-amount-input')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('pay-amount-input').fill(String(sobrepago))
    await page.getByTestId('pay-method-cash').click()
    await page.getByTestId('pay-confirm-btn').click()

    // El front traga el 400 del backend y muestra un mensaje genérico.
    await expect(
      page.getByTestId('toast-error').filter({ hasText: 'Error al guardar el pago' }),
    ).toBeVisible({ timeout: 15_000 })

    // Sin side-effects: la factura conserva saldo y estado; no se creó ningún pago.
    const after = await getInvoice(page, invoiceId)
    expect(Number(after.balance)).toBe(balance)
    expect(after.status).toBe(invoice.status)
    const pays = await apiGet<any>(page, '/api/payments?limit=200')
    const payList: any[] = pays.data ?? pays
    expect(
      payList.find((p) => p.invoiceId === invoiceId && p.status === 'completed'),
      'no debe existir pago para la factura',
    ).toBeFalsy()
  })
})
