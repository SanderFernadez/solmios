// server-tracking/types.ts — DTOs y tipos del módulo (F3, spec server-tracking).
// DB en inglés. Este archivo describe la API (NO el schema físico — eso vive en model.ts).
//
// Anti-patrón ORM (mem 1805): TODO campo declarado acá debe estar también en `model.ts`.

/** Eventos del funnel (spec.md D13 + spec.md DB). F3 solo dispara 'confirm'; el resto F4. */
export type TrackingEventType =
  | 'view' | 'search' | 'select' | 'upsell'
  | 'form' | 'pay' | 'confirm' | 'abandon'

/** Destino del fire. 'internal' = evento solo persistido (sin HTTP externo). */
export type TrackingTarget = 'meta' | 'ga4' | 'internal'

/** Ciclo de vida del fire. 'skipped' = no se disparó por falta de creds / opt-in. */
export type TrackingStatus = 'pending' | 'sent' | 'failed' | 'skipped'

/** DTO principal — una fila de tracking_event ya persistida. */
export interface TrackingEventDTO {
  id: string
  hotelId: string
  event: TrackingEventType
  meta?: Record<string, unknown> | null
  anonymousId?: string | null
  reservationId?: string | null
  target: TrackingTarget
  status: TrackingStatus
  errorMessage?: string | null
  timestamp: string
  createdAt: string
  updatedAt: string
}

/** Payload de creación interna (lo usa el service cuando dispara un fire). */
export interface CreateTrackingEventDTO {
  hotelId: string
  event: TrackingEventType
  meta?: Record<string, unknown> | null
  anonymousId?: string | null
  reservationId?: string | null
  target: TrackingTarget
  status: TrackingStatus
  errorMessage?: string | null
  timestamp: string
}

/** Resultado de un fire (Meta o GA4). Para telemetry + tests. */
export interface FireResult {
  /** Status final del fire. 'skipped' si faltan creds u opt-in. */
  status: TrackingStatus
  /** ID del tracking_event persistido (siempre se persiste, vaya o no el fire). */
  eventId: string
  /** Mensaje de error si status='failed'. */
  errorMessage?: string
  /** Response body del externo (Meta/GA4) si status='sent'. Para debugging. */
  response?: unknown
}

/** Resultado del test-fire admin (POST /api/server-tracking/test). */
export interface TestFireResult {
  meta: FireResult
  ga4: FireResult
}

/** Usuario actual (del JWT o `system` para triggers del webhook). */
export interface CurrentUser {
  id: string
  role: string
  hotelId?: string
}

/** Datos del huésped + reserva necesarios para construir los payloads. */
export interface ReservationTrackingData {
  reservationId: string
  hotelId: string
  roomId: string
  totalAmount: number
  currency: string
  /** Email del huésped (hashear antes de mandar a Meta — Enhanced Conversions). */
  guestEmail?: string | null
  /** Teléfono del huésped (hashear antes de mandar a Meta — Enhanced Conversions). */
  guestPhone?: string | null
  /** Consentimiento marketing (reservas.marketingAccepted). Si false → NO se manda PII. */
  marketingAccepted: boolean
  /** Anonymous ID del navegador (propagado por el widget F2). Vacío пока. */
  anonymousId?: string | null
}

/** Config de tracking del hotel (leída de `configuration`). */
export interface TrackingConfig {
  metaPixelId?: string | null
  metaCapiToken?: string | null
  metaTestEventCode?: string | null
  ga4MeasurementId?: string | null
  ga4ApiSecret?: string | null
}

/** Tipo del fetcher HTTP inyectable (para testear sin tocar la red). */
export type TrackingFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>
