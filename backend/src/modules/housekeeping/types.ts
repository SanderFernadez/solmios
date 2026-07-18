export type CleaningType = 'full_cleaning' | 'quick_cleaning' | 'deep_cleaning' | 'inspection' | 'maintenance'
export type CleaningPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CleaningStatus = 'pending' | 'in_progress' | 'completed' | 'inspected'

/** Usuario autenticado derivado del JWT (HotelAuth reinyecta hotelId). */
export type HousekeepingUser = { id: string; role: string; hotelId?: string }

export interface CleaningItem {
  name: string
  done: boolean
}

export interface PhotoEvidence {
  /** A qué requisito/área corresponde la foto (cama, baño, `supervisor_presence`…).
   *  La app lo usa para llenar los recuadros de evidencia; se persiste desde `addPhoto`. */
  areaId?: string
  url: string
  path: string
  name: string
  size: number
  mimeType: string
  uploadedAt: string
}

/**
 * Video de evidencia de fin, cuando el hotel usa el modo `video`. Uno solo por
 * tarea. Los bytes NO pasan por el backend: la app los sube directo al bucket con
 * una URL prefirmada y después confirma acá la url + la duración.
 */
export interface VideoEvidence {
  url: string
  path: string
  /** Duración REAL leída del archivo en el bucket, no la que declaró la app. */
  durationSeconds: number
  mimeType: string
  uploadedAt: string
  /** Tamaño real del objeto. */
  sizeBytes?: number
  /** `avc1` (H.264), `hvc1`/`hev1` (HEVC). */
  codec?: string | null
  width?: number | null
  height?: number | null
  /**
   * `false` cuando el teléfono grabó en HEVC: el navegador no lo decodifica y el
   * panel ofrece descargarlo en vez de mostrar un cuadro negro. El servidor lo
   * convierte a H.264 y entonces pasa a `true`.
   */
  playableInBrowser?: boolean
  /** El servidor lo está convirtiendo a H.264 en este momento. */
  transcoding?: boolean
  /** Codec con el que se grabó, si hubo que convertirlo (queda como rastro). */
  originalCodec?: string | null
}

export interface StaffStats {
  staffId: string
  completed: number
  avgDurationMs: number
  totalDurationMs: number
}

export interface StaffStatsQuery {
  hotelId?: string
  from?: string
  to?: string
}

export interface HousekeepingDTO {
  id: string
  roomId: string
  hotelId: string
  staffId?: string
  type?: CleaningType
  priority?: CleaningPriority
  status?: CleaningStatus
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: CleaningItem[]
  startTime?: string
  endTime?: string
  /** Pausa del cronómetro: `pausedAt` = pausada desde (null si corre); `pausedSeconds` = acumulado. */
  pausedAt?: string | null
  pausedSeconds?: number
  photos?: PhotoEvidence[]
  supervisorId?: string
  /** Motivo con el que el supervisor/admin DEVOLVIÓ la limpieza (reject). La app lo muestra a la camarera. */
  supervisorNote?: string | null
  supOnSiteTime?: string
  /** Calificación 1–10 que el supervisor le puso a la limpieza al aprobarla. */
  rating?: number | null
  /** Video de evidencia de fin (solo si el hotel usa el modo `video`). */
  video?: VideoEvidence | null
  createdAt: string
  updatedAt: string
}

export interface CreateHousekeepingDTO {
  roomId: string
  hotelId: string
  staffId?: string
  type?: CleaningType
  priority?: CleaningPriority
  status?: CleaningStatus
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: CleaningItem[]
}

export interface UpdateHousekeepingDTO {
  roomId?: string
  // NOTE: hotelId intentionally NOT here — cannot move task between hotels
  staffId?: string
  type?: CleaningType
  priority?: CleaningPriority
  status?: CleaningStatus
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: CleaningItem[]
  startTime?: string
  endTime?: string
  photos?: PhotoEvidence[]
}

export interface HousekeepingQuery {
  hotelId?: string
  status?: CleaningStatus
  type?: CleaningType
  priority?: CleaningPriority
  roomId?: string
  staffId?: string
  search?: string
  page?: number
  limit?: number
}

export interface HousekeepingPaginated {
  data: HousekeepingDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
