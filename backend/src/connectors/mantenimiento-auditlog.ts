// connectors/mantenimiento-auditlog.ts — SC-05: registra en el audit log los borrados de órdenes de trabajo.
// `mantenimiento` declara el puerto (shared/usecases/audit) y este connector inyecta la implementación:
// los módulos nunca se importan entre sí (regla del framework). El connector solo DELEGA.
//
// OJO: el módulo ya tiene un historial INTERNO por ticket (tabla maintenance_audit). Ese historial
// muere con el ticket; este audit log es el global del sistema y sobrevive al borrado.

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

export function mantenimientoAuditlogConnector(ctx: ConnectorContext): void {
  const mantenimiento = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('mantenimiento')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  mantenimiento.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'maintenance_order',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
