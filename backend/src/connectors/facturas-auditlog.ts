// connectors/facturas-auditlog.ts — Conector entre módulos
// Registra en el audit log quién creó, cobró, anuló, envió o borró cada factura.
// `facturas` declara el puerto (usecases/audit.ts) y este conector inyecta la
// implementación: los módulos nunca se importan entre sí (regla del framework).

import type { ConnectorContext } from 'arckode-framework'
import type { AuditEntry } from '../modules/facturas'

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

export function facturasAuditlogConnector(ctx: ConnectorContext): void {
  const facturas = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('facturas')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  facturas.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: 'invoice',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
