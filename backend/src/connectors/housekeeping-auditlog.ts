// connectors/housekeeping-auditlog.ts — SC-05: registra en el audit log los borrados de tareas de limpieza.
// `housekeeping` declara el puerto (shared/usecases/audit) y este connector inyecta la implementación:
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

export function housekeepingAuditlogConnector(ctx: ConnectorContext): void {
  const housekeeping = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('housekeeping')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  housekeeping.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'housekeeping_task',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
