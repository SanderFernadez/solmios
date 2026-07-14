// connectors/reservas-auditlog.ts — SC-05: registra en el audit log los borrados de reservas.
// `reservas` declara el puerto (shared/usecases/audit) y este connector inyecta la implementación:
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

export function reservasAuditlogConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('reservas')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  reservas.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'reservation',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
