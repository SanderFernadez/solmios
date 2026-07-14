// connectors/usuarios-auditlog.ts — SC-05: registra los cambios de rol y los borrados de usuarios.
// `usuarios` declara el puerto (usecases/audit) y este connector inyecta la implementación:
// los módulos nunca se importan entre sí (regla del framework). El connector solo DELEGA.
//
// Complementa a `roles-auditlog`: aquel audita cómo se define un rol, éste a quién se le asigna.

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

export function usuariosAuditlogConnector(ctx: ConnectorContext): void {
  const usuarios = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('usuarios')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  usuarios.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'user',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
