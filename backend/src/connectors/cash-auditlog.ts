// connectors/cash-auditlog.ts — SC-05: deja rastro de quién toca el efectivo real.
// `caja` declara el puerto (usecases/audit) y este connector inyecta la implementación:
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

export function cashAuditlogConnector(ctx: ConnectorContext): void {
  const caja = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('caja')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  caja.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'cash_movement',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
