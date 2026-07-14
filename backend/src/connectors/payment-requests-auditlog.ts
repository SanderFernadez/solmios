// connectors/payment-requests-auditlog.ts — SC-05: rastro de las solicitudes de pago.
// `payment-requests` declara el puerto (usecases/audit) y este connector inyecta la implementación:
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

export function paymentRequestsAuditlogConnector(ctx: ConnectorContext): void {
  const paymentRequests = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('payment-requests')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  paymentRequests.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'payment_request',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
