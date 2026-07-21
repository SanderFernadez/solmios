// connectors/pricing-canales.ts — Push automático de tarifas a las OTAs.
// pricing emite onRatesUpdated cuando cambian tarifas; canales las empuja a Channex.
// Antes el push era MANUAL (endpoint POST /api/channels/push-rates): editar tarifas no las
// reflejaba en las OTAs hasta que alguien apretaba el botón → riesgo de vender a precio viejo.
// Fire-and-forget: el push a Channex es una llamada de red; NO debe bloquear el guardado del
// grid ni romperlo. Errores (hotel sin Channex, red) se tragan acá; canales loguea internamente.

import type { ConnectorContext } from 'arckode-framework'

export function pricingCanalesConnector(ctx: ConnectorContext): void {
  const pricing = ctx.resolveModule<{ setSockets: (s: any) => void }>('pricing')
  pricing.setSockets({
    onRatesUpdated: async (hotelId: string) => {
      try {
        const canales = ctx.resolveModule<{ pushSeasonalRates: (hotelId: string, channel?: string) => Promise<unknown> }>('canales')
        // No await: se dispara y sigue. El .catch evita una promesa rechazada sin manejar.
        void canales.pushSeasonalRates(hotelId).catch(() => {})
      } catch {
        // canales puede no estar disponible (módulo desactivado). No rompe el guardado de tarifas.
      }
    },
  })
}
