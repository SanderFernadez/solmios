import { test, expect } from '../fixtures'
import { apiGet, apiPost } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// DEV-10 — Ciclo completo de compras (el flujo con más etapas y actores distintos de todo
// USE_CASES.md: requisición → aprobación → orden de compra → envío → recepción (parcial y total)
// → facturación). Ejercido 100% por API contra el backend real de dev — el módulo no tiene un
// wizard de UI (solo listados/detalle en /panel/compras/*), a diferencia de reservas — con un
// checkpoint de UI al final para confirmar que lo que ve el usuario coincide con el estado real.
//
// Cubre (ver DEV-10 en USE_CASES.md):
//   - Transición draft→submitted→approved de la requisición.
//   - La orden nace de una requisición APROBADA (requisitionId) con líneas propias (precio real).
//   - Recepción PARCIAL no cierra la orden; recepción del resto la pasa a `received` sola.
//   - Facturar genera UN gasto y cierra la orden (`closed`); facturar de nuevo es idempotente
//     (dedup por expenseId — QA-H2 del código: no crea un segundo gasto).
//   - Casos borde: transición inválida (409), recibir más de lo pendiente (400/ValidationError),
//     recibir contra una orden que no está `sent` (409).

function uniqueDescription(prefix: string): string {
  return `${prefix} ${Date.now()}`
}

/** Las respuestas del backend vienen envueltas en `{success, data, meta, error}` (ver http.ts /
 *  ApiResponse del framework) — apiPost/apiGet devuelven el JSON crudo, así que hay que desenvolver
 *  `.data` acá (mismo criterio que `res.data ?? res` que ya usan los demás specs de la suite). */
function unwrap<T = any>(body: any): T {
  return (body?.data ?? body) as T
}

test.describe('DEV-10 — ciclo completo de compras', () => {
  test('requisición → aprobación → orden → envío → recepción parcial+total → factura (idempotente)', async ({ page }) => {
    // localStorage (token de la sesión pre-autenticada) vive bajo el origin del frontend — hay que
    // navegar ahí antes de que apiGet/apiPost puedan leerlo (mismo motivo que el resto de la suite).
    await page.goto('/panel/compras/requisiciones')

    // — 1. Requisición (draft) con una línea —
    const reqCreate = await apiPost(page, '/api/compras/requisitions', {
      notes: 'QA ciclo de compras',
      items: [{ description: uniqueDescription('Sábanas'), quantity: 20 }],
    })
    expect(reqCreate.status, 'crear la requisición debió ser 2xx').toBeLessThan(300)
    const created = unwrap<any>(reqCreate.body)
    const requisitionId = created.id
    expect(requisitionId).toBeTruthy()
    expect(created.status).toBe('draft')

    // — 2. Enviar a aprobación (draft→submitted) —
    const submit = await apiPost(page, `/api/compras/requisitions/${requisitionId}/submit`, {})
    expect(submit.status, 'submit debió ser 2xx').toBeLessThan(300)
    expect(unwrap<any>(submit.body).status).toBe('submitted')

    // — 3. Aprobar (submitted→approved) —
    const approve = await apiPost(page, `/api/compras/requisitions/${requisitionId}/transition`, { status: 'approved' })
    expect(approve.status, 'approve debió ser 2xx').toBeLessThan(300)
    expect(unwrap<any>(approve.body).status).toBe('approved')

    // — 4. Orden de compra desde la requisición aprobada, con línea propia (precio real: la copia
    // automática de líneas de la requisición NO trae unitPrice, y sin monto no se puede facturar
    // más adelante — ver ValidationError('La orden no tiene monto para facturar') en receipts.ts). —
    const quantity = 20
    const unitPrice = 15
    const orderCreate = await apiPost(page, '/api/compras/orders', {
      requisitionId,
      items: [{ description: uniqueDescription('Sábanas OC'), quantity, unitPrice }],
    })
    expect(orderCreate.status, 'crear la orden debió ser 2xx').toBeLessThan(300)
    const order = unwrap<any>(orderCreate.body)
    const orderId = order.id
    expect(order.requisitionId).toBe(requisitionId)
    expect(order.status).toBe('draft')
    expect(order.subtotal).toBeCloseTo(quantity * unitPrice, 2)
    // Impuesto de configuration('taxes') del hotel, NO hardcodeado acá — solo verificamos la
    // relación (total = subtotal + tax, tax nunca negativo), no un % fijo.
    expect(order.tax).toBeGreaterThanOrEqual(0)
    expect(order.total).toBeCloseTo(order.subtotal + order.tax, 2)
    const orderItemId = order.items[0].id

    // — 5. Enviar la orden (draft→sent) —
    const send = await apiPost(page, `/api/compras/orders/${orderId}/transition`, { status: 'sent' })
    expect(send.status, 'send debió ser 2xx').toBeLessThan(300)
    expect(unwrap<any>(send.body).status).toBe('sent')

    // — 6. Recepción PARCIAL (12 de 20) — la orden NO debe pasar a `received` todavía. —
    const receive1 = await apiPost(page, `/api/compras/orders/${orderId}/receive`, {
      lines: [{ orderItemId, quantity: 12 }],
    })
    expect(receive1.status, 'recepción parcial debió ser 2xx').toBeLessThan(300)
    const afterPartial = unwrap<any>(await apiGet(page, `/api/compras/orders/${orderId}`))
    expect(afterPartial.status, 'la orden debe seguir en sent tras recepción parcial').toBe('sent')
    expect(afterPartial.items[0].receivedQty).toBeCloseTo(12, 4)

    // — 7. Recepción del resto (8 de 20) — ahora sí, `received` automático. —
    const receive2 = await apiPost(page, `/api/compras/orders/${orderId}/receive`, {
      lines: [{ orderItemId, quantity: 8 }],
    })
    expect(receive2.status, 'recepción final debió ser 2xx').toBeLessThan(300)
    const afterFull = unwrap<any>(await apiGet(page, `/api/compras/orders/${orderId}`))
    expect(afterFull.status).toBe('received')
    expect(afterFull.items[0].receivedQty).toBeCloseTo(quantity, 4)

    // — 8. Facturar: genera UN gasto y cierra la orden. —
    const invoiceNumber = `QA-${Date.now()}`
    const invoice1 = await apiPost(page, `/api/compras/orders/${orderId}/invoice`, { invoiceNumber })
    expect(invoice1.status, 'facturar debió ser 2xx').toBeLessThan(300)
    const inv1 = unwrap<any>(invoice1.body)
    expect(inv1.status).toBe('closed')
    expect(inv1.expenseId, 'facturar debió generar un gasto').toBeTruthy()
    expect(inv1.invoiceNumber).toBe(invoiceNumber)
    const expenseId = inv1.expenseId

    // — 9. Facturar DE NUEVO (doble click / reintento) — idempotente: mismo expenseId, no crea
    // un segundo gasto (dedup en markInvoiced, QA-H2). —
    const invoice2 = await apiPost(page, `/api/compras/orders/${orderId}/invoice`, { invoiceNumber: 'OTRO-NUMERO' })
    expect(invoice2.status, 'el segundo invoice también responde 2xx (no-op, no error)').toBeLessThan(300)
    const inv2 = unwrap<any>(invoice2.body)
    expect(inv2.expenseId, 'el segundo invoice no debe generar un gasto nuevo').toBe(expenseId)
    expect(inv2.status).toBe('closed')

    // — 10. Checkpoint de UI: lo que ve el usuario coincide con el estado real (Cerrada + badge
    // "Facturada"), buscando la fila por el número de orden (no hay data-testid en esta tabla). —
    await page.goto('/panel/compras/ordenes')
    const row = page.locator('tr').filter({ hasText: order.number })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText('Cerrada')
    await expect(row).toContainText('Facturada')
  })

  test('casos borde: transición inválida, recibir sin enviar, recibir de más', async ({ page }) => {
    await page.goto('/panel/compras/requisiciones')

    // Transición inválida: una requisición recién creada (draft) no puede saltar a 'approved'
    // directo — tiene que pasar por 'submitted' primero.
    const reqCreate = await apiPost(page, '/api/compras/requisitions', {
      items: [{ description: uniqueDescription('Borde'), quantity: 1 }],
    })
    const requisitionId = unwrap<any>(reqCreate.body).id
    const badTransition = await apiPost(page, `/api/compras/requisitions/${requisitionId}/transition`, { status: 'approved' })
    expect(badTransition.status, 'draft→approved directo debe rechazarse (409)').toBe(409)

    // Recibir contra una orden que todavía está en `draft` (nunca se envió) → 409.
    const orderCreate = await apiPost(page, '/api/compras/orders', {
      items: [{ description: uniqueDescription('Borde OC'), quantity: 5, unitPrice: 10 }],
    })
    const order = unwrap<any>(orderCreate.body)
    const orderItemId = order.items[0].id
    const receiveOnDraft = await apiPost(page, `/api/compras/orders/${order.id}/receive`, {
      lines: [{ orderItemId, quantity: 1 }],
    })
    expect(receiveOnDraft.status, 'recibir una orden en draft (no sent) debe rechazarse (409)').toBe(409)

    // Enviar la orden y ahora sí intentar recibir MÁS de lo pedido (5 pedidas, se intentan 6).
    await apiPost(page, `/api/compras/orders/${order.id}/transition`, { status: 'sent' })
    const receiveTooMuch = await apiPost(page, `/api/compras/orders/${order.id}/receive`, {
      lines: [{ orderItemId, quantity: 6 }],
    })
    expect(receiveTooMuch.status, 'recibir más de lo pendiente debe rechazarse (400)').toBe(400)

    // La orden no debe haber quedado con receivedQty parcial por el intento fallido.
    const after = unwrap<any>(await apiGet(page, `/api/compras/orders/${order.id}`))
    expect(after.items[0].receivedQty || 0).toBe(0)
  })
})
