import type { ConnectorContext } from 'arckode-framework'
import { settleFolioAtCheckout, type SettleFolioParams, type SettleFolioResult } from '../shared/usecases/settle-folio-at-checkout'

export function reservasFoliosSettlementConnector(ctx: ConnectorContext): void {
  const folios = ctx.resolveModule<any>('folios')
  const facturas = ctx.resolveModule<any>('facturas')
  const reservas = ctx.resolveModule<any>('reservas')

  reservas.setOrchestrationDeps({
    settleFolio: async (params: SettleFolioParams, user: any): Promise<SettleFolioResult> => settleFolioAtCheckout(folios, facturas, params, user),
  })
}
