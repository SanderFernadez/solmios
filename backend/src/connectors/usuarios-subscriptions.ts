// connectors/usuarios-subscriptions.ts — Wire: usuarios → subscriptions
//
// El login necesita saber si el hotel puede operar, pero `usuarios` no puede
// importar `subscriptions` (módulos aislados). Se le pasa la función y listo.
//
// Sin este connector el login sigue funcionando como siempre: nadie queda
// bloqueado por accidente si el módulo no está cargado.
import type { ConnectorContext } from 'arckode-framework'

export function usuariosSubscriptionsConnector(ctx: ConnectorContext): void {
  const usuarios = ctx.resolveModule<{ setSubscriptionCheck?: (fn: any) => void }>('usuarios')
  const subscriptions = ctx.resolveModule<{ checkAccess: (hotelId: string) => Promise<any> }>('subscriptions')
  usuarios.setSubscriptionCheck?.((hotelId: string) => subscriptions.checkAccess(hotelId))
}
