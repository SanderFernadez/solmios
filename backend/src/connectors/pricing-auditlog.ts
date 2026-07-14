// connectors/pricing-auditlog.ts — SC-05: rastro de quién cambia los precios.
// `pricing` declara el puerto (usecases/audit) y este connector inyecta la implementación:
// los módulos nunca se importan entre sí (regla del framework). El connector solo DELEGA.

import type { ConnectorContext } from 'arckode-framework'
import type { AuditEntry } from '../shared/usecases/audit'

interface AuditlogModule {
  create: (dto: {
    hotelId?: string
    userId?: string
    action: string
    entity?: string
    entityId?: string
    detail?: string
  }) => Promise<unknown>
}

export function pricingAuditlogConnector(ctx: ConnectorContext): void {
  const pricing = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('pricing')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  pricing.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'room_rate',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
