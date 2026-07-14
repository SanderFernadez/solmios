// connectors/payroll-auditlog.ts — SC-05: rastro de quién aprueba y paga los sueldos.
// `payroll` declara el puerto (usecases/audit) y este connector inyecta la implementación:
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

export function payrollAuditlogConnector(ctx: ConnectorContext): void {
  const payroll = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('payroll')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  payroll.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'payroll_run',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
