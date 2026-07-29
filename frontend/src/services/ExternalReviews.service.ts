// ExternalReviews.service.ts — F3 3.5 (solmi-direct-booking / reputation-aggregator)
// Service para el panel admin de "Reputación externa": sync manual + lectura de status.
// Las credenciales (GBP/TripAdvisor/StayAPI) se persisten vía ConfigService (tabla
// `configuration`) — son valores por hotel, NO viajan acá.
import { http } from './http'

/** Resultado del POST /api/external-reviews/sync-now. */
export interface SyncNowResult {
  hotelId: string
  inserted: number
  updated: number
  skippedSources: number
  errors: string[]
  /** true si el hotel no tenía creds configuradas (no había nada que sincronizar). */
  noCreds: boolean
}

export const ExternalReviewsService = {
  /** Dispara el pull manualmente para el hotel del JWT. */
  syncNow: () => http.post<SyncNowResult>('/external-reviews/sync-now'),
}
