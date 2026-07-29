// ServerTracking.service.ts — F3 3.13 (solmi-direct-booking / server-tracking)
// Service para el panel admin de "Tracking y conversión": dispara test-fire + lee historial.
// Las credenciales (Meta Pixel ID, CAPI token, GA4 measurement_id, api_secret) se persisten
// vía ConfigService (tabla `configuration`) — son valores por hotel, NO viajan acá.
import { http } from './http'

/** Resultado de un fire individual (Meta o GA4). Espeja el FireResult del backend. */
export interface FireResult {
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  eventId: string
  errorMessage?: string
  response?: unknown
}

/** Resultado del POST /api/server-tracking/test. */
export interface TestFireResult {
  hotelId: string
  meta: FireResult
  ga4: FireResult
}

/** Item del historial de fires (GET /api/server-tracking/events). */
export interface TrackingEventItem {
  id: string
  hotelId: string
  event: string
  target: 'meta' | 'ga4' | 'internal'
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  reservationId?: string | null
  errorMessage?: string | null
  timestamp: string
  createdAt: string
}

export const ServerTrackingService = {
  /** Dispara evento de TEST a Meta + GA4 (spec.md "Test mode para dev"). */
  testFire: (reservationId?: string) =>
    http.post<TestFireResult>('/server-tracking/test', reservationId ? { reservationId } : {}),

  /** Historial de fires para auditoría (spec.md "Persistencia de eventos para auditoría"). */
  events: (params?: { reservationId?: string; target?: string; status?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.reservationId) qs.set('reservationId', params.reservationId)
    if (params?.target) qs.set('target', params.target)
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return http.get<{ data: TrackingEventItem[]; total: number }>(`/server-tracking/events${q ? `?${q}` : ''}`)
  },
}
