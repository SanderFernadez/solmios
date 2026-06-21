// auditlog/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { AuditlogDTO } from './types'

export interface AuditlogSockets {
  onAuditlogCreated?: (data: AuditlogDTO) => Promise<void>
  onAuditlogUpdated?: (data: AuditlogDTO) => Promise<void>
  onAuditlogDeleted?: (id: string) => Promise<void>
}
