// connectors/ai-recepcionista-auditlog.ts — SC-05: registra en el audit log los borrados de intenciones y plantillas de la IA.
// `ai-recepcionista` declara el puerto (shared/usecases/audit) y este connector inyecta la implementación:
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

export function aiRecepcionistaAuditlogConnector(ctx: ConnectorContext): void {
  const aiRecepcionista = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('ai-recepcionista')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  aiRecepcionista.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'ai_intent',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
