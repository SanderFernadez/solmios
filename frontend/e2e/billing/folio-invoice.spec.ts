import { test, expect } from '../fixtures'
import { createOpenFolio, getInvoice, apiGet, apiPost } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// FAC-03 — Folio → factura en una sola operación (QA real).
//
// `POST /folios/:id/invoice` cierra el folio Y emite la factura atómicamente. Reglas de
// compensación: si la factura falla tras cerrar, el folio se reabre; si falla el setInvoice
// después de crearla, NO se reabre (evita doble-facturar). Este spec ejercita el endpoint directo
// (el MISMO que invoca el botón "Cerrar y facturar" de /panel/finanzas/folios) y verifica el
// efecto atómico: folio → closed + factura vinculada + total correcto.
//
// Se prueba por endpoint y no por el botón UI porque la vista de folios es frágil de automatizar
// (lista filtrada a `open`, fila colapsable que expone el botón en un <tr> hermano, ConfirmModal
// genérico) y la DB de dev acumula folios de corridas previas que dejan el recién creado fuera
// del corte. La cobertura del flujo completo de facturación por UI ya está en invoice-pay.spec y
// credit-note.spec (que emiten facturas con este mismo endpoint vía createPendingInvoice).

test.describe('FAC-03 — folio→factura atómico', () => {
  test('cerrar+facturar deja folio closed y factura emitida con el total del folio', async ({ page }) => {
    const { folioId } = await createOpenFolio(page)
    const folioBefore = await apiGet<any>(page, `/api/folios/${folioId}`)
    const chargesTotal = Number((folioBefore.data ?? folioBefore).chargesTotal || 0)

    // La operación atómica: UN request cierra el folio y emite la factura.
    const res = await apiPost<any>(page, `/api/folios/${folioId}/invoice`)
    expect(res.status, 'POST /folios/:id/invoice debió ser 2xx').toBeLessThan(300)
    const invoiceId = res.body.invoice?.id ?? res.body.id ?? res.body.data?.invoice?.id
    expect(invoiceId, 'el cierre+factura debió devolver el invoiceId').toBeTruthy()

    // Folio cerrado y vinculado a la factura.
    const folioAfter = await apiGet<any>(page, `/api/folios/${folioId}`)
    const folioBody = folioAfter.data ?? folioAfter
    expect(folioBody.status).toBe('closed')
    expect(folioBody.invoiceId).toBe(invoiceId)

    // La factura existe `pending` con el total de los cargos del folio.
    const invoice = await getInvoice(page, invoiceId)
    expect(invoice, 'la factura debió crearse').toBeTruthy()
    expect(invoice.status).toBe('pending')
    const total = Number(invoice.total ?? invoice.amount ?? invoice.totalAmount)
    expect(total, 'el total de la factura debe igualar los cargos del folio').toBeCloseTo(chargesTotal, 1)
  })
})
