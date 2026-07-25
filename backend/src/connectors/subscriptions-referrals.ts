// connectors/subscriptions-referrals.ts — Conector entre módulos
// Cuando el alta pública trae `referralCode`, referrals se entera y crea la fila `referrals`.
// Conecta: subscriptions → referrals. Ninguno de los dos módulos se importa entre sí.
import type { ConnectorContext } from 'arckode-framework'

export function subscriptionsReferralsConnector(ctx: ConnectorContext): void {
  const referrals = ctx.resolveModule<{ linkSignup: (hotelId: string, code: string) => Promise<void> }>('referrals')
  const subscriptions = ctx.resolveModule<{ setSockets: (s: any) => void }>('subscriptions')

  subscriptions.setSockets({
    onTrialStarted: async (payload: { hotelId: string; trialEndsAt: string; referralCode?: string }) => {
      if (!payload.referralCode) return
      await referrals.linkSignup(payload.hotelId, payload.referralCode)
    },
  })
}
