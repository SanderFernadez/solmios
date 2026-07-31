// connectors/reservas-promocodes.ts — Wire: reservas (staff) → promo-codes
//
// FIX 2026-07-31 — hallazgo real: el wizard de reserva manual del staff (panel) tenía un
// campo "Código promocional" que se guardaba como texto SIN validar ni aplicar ningún
// descuento — cero efecto en el precio. Solo funcionaba en el widget público (F2.5).
//
// Este connector cablea `reservas.usecases.crud:createReservation` (vía
// `ReservasService.orchestrationDeps.promoCodes`, patrón `PromoCodePort`) contra el módulo
// `promo-codes` real: valida el código justo antes de crear la reserva (protege contra
// códigos vencidos/agotados que quedaron aplicados en un form abierto mucho tiempo) e
// incrementa `uses` después de crear exitosamente — mismo criterio de atomicidad-suave que
// el flujo público (nunca se consume un uso si la reserva no llegó a crearse).
import type { ConnectorContext } from 'arckode-framework'

interface PromoCodesModule {
  validate: (hotelId: string, code: string, subtotal: number) => Promise<{ valid: boolean; discount: number; reason?: string; code?: string }>
  incrementUsesByCode: (hotelId: string, code: string) => Promise<void>
}

interface ReservasModule {
  setOrchestrationDeps: (deps: Record<string, unknown>) => void
}

export function reservasPromocodesConnector(ctx: ConnectorContext): void {
  const promoCodes = ctx.resolveModule<PromoCodesModule>('promo-codes')
  const reservas = ctx.resolveModule<ReservasModule>('reservas')

  reservas.setOrchestrationDeps({
    promoCodes: {
      validate: (hotelId: string, code: string, subtotal: number) => promoCodes.validate(hotelId, code, subtotal),
      incrementUses: (hotelId: string, code: string) => promoCodes.incrementUsesByCode(hotelId, code),
    },
  })
}
