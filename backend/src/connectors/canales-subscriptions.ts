// connectors/canales-subscriptions.ts — Wire: canales → subscriptions (#542)
//
// El cron global de ingesta de bookings OTA (booking-sync) necesita saber si el hotel puede
// operar antes de crear una reserva nueva. `canales` no puede importar `subscriptions`
// (módulos aislados). Se le pasa la función y listo — mismo molde que usuarios-subscriptions.
//
// Sin este connector el sync sigue funcionando como siempre: ningún hotel queda bloqueado
// por accidente si el módulo no está cableado.
import type { ConnectorContext } from 'arckode-framework'

export function canalesSubscriptionsConnector(ctx: ConnectorContext): void {
  const canales = ctx.resolveModule<{ setSubscriptionCheck?: (fn: any) => void }>('canales')
  const subscriptions = ctx.resolveModule<{ checkAccess: (hotelId: string) => Promise<any> }>('subscriptions')
  canales.setSubscriptionCheck?.((hotelId: string) => subscriptions.checkAccess(hotelId))
}
