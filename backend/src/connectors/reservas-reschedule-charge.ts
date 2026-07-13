import type { ConnectorContext } from 'arckode-framework'
import { chargeRescheduleDiff } from '../shared/usecases/charge-reschedule-diff'
import type { RescheduleChargeParams } from '../modules/reservas/usecases/reschedule'

// Cablea el cobro de la diferencia al reprogramar/extender una reserva:
// reservas delega en folios (cargo a la cuenta), payments (efectivo→caja) o Stripe (tarjeta).
export function reservasRescheduleChargeConnector(ctx: ConnectorContext): void {
  const folios = ctx.resolveModule<any>('folios')
  const payments = ctx.resolveModule<any>('payments')
  const reservas = ctx.resolveModule<any>('reservas')

  reservas.setOrchestrationDeps({
    chargeReschedule: (params: RescheduleChargeParams, user: any) => chargeRescheduleDiff(folios, payments, params, user),
  })
}
