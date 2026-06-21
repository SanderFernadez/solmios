// auditlog/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const AuditlogModel: ModelDefinition = {
  table: 'audit_log',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string' },
    userId: { type: 'string' },
    userName: { type: 'string' },
    action: { type: 'string', required: true },
    entity: { type: 'string' },
    entityId: { type: 'string' },
    detail: { type: 'text' },
    ip: { type: 'string' },
  },
  timestamps: true,
}

export function registerAuditlogModels(orm: ORM): void {
  orm.define('Auditlog', AuditlogModel)
}
