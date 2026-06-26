// empleados/sockets.ts — Eventos del módulo

import type { EmployeeProfileDTO, DocumentDTO, LeaveRequestDTO } from './types'

export interface EmpleadosSockets {
  onEmployeeCreated?: (profile: EmployeeProfileDTO) => Promise<void>
  onEmployeeDeactivated?: (profile: EmployeeProfileDTO) => Promise<void>
  onDocumentExpiring?: (doc: DocumentDTO, daysLeft: number) => Promise<void>
  onLeaveRequestPending?: (request: LeaveRequestDTO) => Promise<void>
}
