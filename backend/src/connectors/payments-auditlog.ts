// connectors/payments-auditlog.ts — SC-05: deja rastro de todo movimiento de dinero.
// `payments` declara el puerto (usecases/audit) y este connector inyecta la implementación:
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

export function paymentsAuditlogConnector(ctx: ConnectorContext): void {
  const payments = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('payments')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  payments.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'payment',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
