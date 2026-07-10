// housekeeping/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { HousekeepingDTO } from './types'

/** Una incidencia que la camarera manda a mantenimiento desde su tarea. */
export interface IssueReport {
  hotelId: string
  roomId?: string
  /** Lo que la camarera escribió: sin esto no hay nada que arreglar. */
  description: string
  /** Las fotos de la tarea. Son la evidencia de qué está roto. */
  photos: unknown[]
  /** Quién lo reportó, para no avisarle a él mismo del ticket. */
  reportedBy: string
}

export interface HousekeepingSockets {
  onHousekeepingCreated?: (data: HousekeepingDTO) => Promise<void>
  onHousekeepingUpdated?: (data: HousekeepingDTO) => Promise<void>
  onHousekeepingDeleted?: (id: string) => Promise<void>
  /**
   * La camarera reportó algo roto. Lo cablea `connectors/housekeeping-mantenimiento`,
   * que abre el ticket. Sin este hook, `reportIssue` solo dejaba una nota en la
   * tarea de limpieza y mantenimiento nunca se enteraba.
   */
  onIssueReported?: (issue: IssueReport) => Promise<void>
}
