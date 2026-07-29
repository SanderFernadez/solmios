// connectors/reservas-wallet.ts — Wallet pass al confirmar la reserva (F3 3.8).
//
// Spec: wallet-pass/spec.md "Generación automática al confirmar". El webhook Stripe confirma
// la reserva → bookingengine emite `onBookingPaid({ id: reservationId })` → este connector
// dispara `walletPassService.generatePass(reservationId)` que orquesta TTLock + Apple + Google
// + persist + email.
//
// Best-effort: try/catch — NO rompe el webhook de confirmación si el pass falla. La reserva
// queda `confirmed` aunque el pass no se haya generado (spec.md "Best-effort, no bloquea
// webhook"). El error se loguea dentro del usecase; aquí re-buffer por si todo el usecase
// crashea (defensa en profundidad).
//
// Patrón idéntico a `bookingengine-payments.ts` (que escucha el mismo socket para asentar
// el dinero): setSockets compone, no pisa. La llamamos `reservas-wallet` porque el pass
// conceptualmente pertenece al dominio de reservas (es un artefacto del huésped confirmado),
// aunque el trigger salga de bookingengine.
import type { ConnectorContext } from 'arckode-framework'

export function reservasWalletConnector(ctx: ConnectorContext): void {
  const bookingengine = ctx.resolveModule<{ setSockets: (s: any) => void }>('bookingengine')

  bookingengine.setSockets({
    onBookingPaid: async (data: { id?: string } | { id: string }) => {
      try {
        const reservationId = (data as { id?: string })?.id
        if (!reservationId) return
        const wallet = ctx.resolveModule<{ generatePass(reservationId: string): Promise<unknown> }>('wallet-pass')
        if (!wallet?.generatePass) return
        await wallet.generatePass(reservationId)
      } catch {
        // Best-effort: el webhook del confirm ya hizo su trabajo (reserva confirmada).
        // El pass es bonus; si falla, no hay rollback. La próxima vez que se dispare el
        // trigger (ej. cron futuro o re-intento admin) reintentará.
      }
    },
  })
}
