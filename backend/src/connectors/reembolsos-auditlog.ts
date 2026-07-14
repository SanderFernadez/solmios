// connectors/reembolsos-auditlog.ts — SC-05: registra en el audit log el borrado de reembolsos (plata).
// `reembolsos` declara el puerto (shared/usecases/audit) y este connector inyecta la implementación:
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

export function reembolsosAuditlogConnector(ctx: ConnectorContext): void {
  const reembolsos = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('reembolsos')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  reembolsos.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'expense-claim',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
