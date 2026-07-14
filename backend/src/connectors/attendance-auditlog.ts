// connectors/attendance-auditlog.ts — SC-05: registra en el audit log los borrados de asistencia.
// `attendance` declara el puerto (shared/usecases/audit) y este connector inyecta la implementación:
// los módulos nunca se importan entre sí (regla del framework). El connector solo DELEGA.
//
// Asistencia alimenta la NÓMINA (connector attendance-payroll): borrar un turno o una asignación
// del roster cambia las horas que se le pagan a una persona. Tiene que quedar quién lo hizo.

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

export function attendanceAuditlogConnector(ctx: ConnectorContext): void {
  const attendance = ctx.resolveModule<{ setAuditDeps: (p: any) => void }>('attendance')
  const auditlog = ctx.resolveModule<AuditlogModule>('auditlog')

  attendance.setAuditDeps({
    record: async (entry: AuditEntry): Promise<void> => {
      await auditlog.create({
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? 'attendance',
        entityId: entry.entityId,
        detail: entry.detail,
      })
    },
  })
}
