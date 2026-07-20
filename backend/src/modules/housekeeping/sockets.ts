// housekeeping/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { HousekeepingDTO } from './types'

/** Una incidencia que la camarera manda a mantenimiento desde su tarea. */
export interface IssueReport {
  hotelId: string
  /** La tarea de limpieza de la que salió. Clave de deduplicación del ticket. */
  taskId: string
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
   * A alguien le acaban de asignar una tarea. Evento propio, no `onHousekeepingUpdated`:
   * ese se dispara también al iniciar y al terminar, y avisaría tres veces de lo mismo.
   * Solo suena cuando la tarea cambia de dueño (o se le asigna por primera vez).
   */
  onTaskAssigned?: (data: HousekeepingDTO) => Promise<void>
  /**
   * La camarera TERMINÓ la limpieza: hay algo para revisar. Evento propio (no
   * `onHousekeepingUpdated`, que suena también al iniciar/pausar), para avisar al
   * supervisor —in-app + push— aunque tenga la app cerrada. Sin esto el supervisor
   * solo se enteraba con la app abierta (polling local del mobile).
   */
  onTaskCompleted?: (data: HousekeepingDTO) => Promise<void>
  /**
   * La camarera reportó algo roto. Lo cablea `connectors/housekeeping-mantenimiento`,
   * que abre el ticket. Sin este hook, `reportIssue` solo dejaba una nota en la
   * tarea de limpieza y mantenimiento nunca se enteraba.
   */
  onIssueReported?: (issue: IssueReport) => Promise<void>
  /**
   * El supervisor aprobó la limpieza (tarea → inspected). Lo cablea
   * `connectors/housekeeping-habitaciones`, que devuelve la habitación a 'available' si sigue en
   * 'cleaning'. Sin este hook la habitación quedaba trabada en 'cleaning' tras el checkout (#392).
   */
  onTaskInspected?: (data: HousekeepingDTO) => Promise<void>
}

/**
 * Métricas agregadas por camarera para el motor de evaluación de desempeño (#321).
 * `staffId` es `users.id`. Puerto de CONSULTA (no un hook de evento): lo lee el connector
 * `empleados-housekeeping` vía el service, sin que empleados importe este módulo.
 */
export interface HousekeepingStaffStat {
  staffId: string
  completed: number
  avgDurationMs: number
  /** Promedio del rating 1-10 del supervisor; null si ninguna tarea del período fue calificada. */
  avgRating: number | null
}

export interface HousekeepingStatsPort {
  getStaffStats(hotelId: string, from: string, to: string): Promise<HousekeepingStaffStat[]>
}
