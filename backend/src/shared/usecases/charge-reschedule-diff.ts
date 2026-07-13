// shared/usecases/charge-reschedule-diff.ts
// Cobra la diferencia de una reserva reprogramada/extendida según el método elegido (regla del negocio):
//   - folio: hay cuenta abierta → se agrega como cargo (se salda en el checkout).
//   - cash:  sin folio → se cobra en efectivo (entra a caja vía connector payments-caja).
//   - card:  se toma de la tarjeta → Stripe Checkout (el sistema NO cobra off-session a tarjeta guardada).
// El dinero se asienta UNA sola vez por la vía correspondiente; no se orquesta desde el frontend.

import type { RescheduleChargeParams, RescheduleChargeResult } from '../../modules/reservas/usecases/reschedule'

export async function chargeRescheduleDiff(
  folios: any,
  payments: any,
  params: RescheduleChargeParams,
  user: any,
): Promise<RescheduleChargeResult> {
  const desc = `Cambio de reserva${params.reason ? ` — ${params.reason}` : ''}`

  if (params.method === 'folio') {
    const list = await folios.list({ reservationId: params.reservationId, status: 'open' }, user)
    let folio = list.data?.[0]
    if (!folio) {
      folio = await folios.open({ hotelId: params.hotelId, reservationId: params.reservationId, guestId: params.guestId, roomId: params.roomId, currency: params.currency }, user)
    }
    const charge = await folios.postCharge(folio.id, { amount: params.amount, description: desc, category: 'room', source: 'reschedule' }, user)
    return { method: 'folio', applied: true, target: 'folio', folioId: folio.id, chargeId: charge.id }
  }

  if (params.method === 'cash') {
    const payment = await payments.createPayment({
      hotelId: params.hotelId, type: 'charge', method: 'cash', amount: params.amount,
      currency: params.currency, description: desc, guestId: params.guestId || undefined,
      status: 'completed', metadata: { reservationId: params.reservationId, source: 'reschedule' },
    })
    return { method: 'cash', applied: true, target: 'cash', paymentId: payment.id }
  }

  // card → Stripe Checkout. Si Stripe no está configurado, devuelve applied:false con el motivo
  // (el frontend muestra "cobrar en efectivo/POS"), sin romper el cambio de fechas ya aplicado.
  try {
    const { payment, checkoutUrl } = await payments.chargeCard({
      hotelId: params.hotelId, amount: params.amount, currency: params.currency, description: desc,
      guestId: params.guestId || undefined, successUrl: params.successUrl || '', cancelUrl: params.cancelUrl || '',
    })
    return { method: 'card', applied: true, target: 'card', paymentId: payment.id, checkoutUrl }
  } catch (e: any) {
    return { method: 'card', applied: false, target: 'card', message: e?.message || 'No se pudo generar el cobro con tarjeta' }
  }
}
