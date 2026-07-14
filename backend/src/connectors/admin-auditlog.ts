// connectors/admin-auditlog.ts — SC-05: registra los borrados de recursos de la PLATAFORMA
// (planes de suscripción, catálogo de amenities). No son de un hotel: afectan a todos.
//
// `admin` declara el puerto (usecases/audit) y este connector inyecta la implementación:
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

export function adminAuditlogConnector(ctx: ConnectorContext): void {
  const admin = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('admin')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  admin.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'platform',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
