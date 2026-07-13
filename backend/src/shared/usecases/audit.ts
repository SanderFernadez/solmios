// shared/usecases/audit.ts — Puerto de auditoría genérico (SC-05).
//
// Los módulos declaran este puerto (setAuditDeps) y un connector inyecta `auditlog.create`
// (sin import cross-módulo, regla del framework). Auditar NUNCA tumba la operación de negocio:
// si el registro falla, se loguea y la operación sigue. Un audit log caído no debe frenar un
// borrado ni un cambio de permisos.

import type { Logger } from 'arckode-framework'

export interface AuditEntry {
  hotelId?: string
  userId?: string
  action: string // ej: 'role.create', 'role.delete', 'user.delete'
  entity?: string // ej: 'role', 'user'
  entityId?: string
  detail?: string
}

export interface AuditPort {
  record(entry: AuditEntry): Promise<void>
}

/** Registra la entrada si hay puerto conectado. Absorbe cualquier fallo del audit log. */
export async function auditSafely(port: AuditPort | null, logger: Logger, entry: AuditEntry): Promise<void> {
  if (!port) return
  try {
    await port.record(entry)
  } catch (e) {
    logger.error('No se pudo registrar la auditoría', { action: entry.action, error: String(e) })
  }
}
