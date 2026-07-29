// server-tracking/model.ts — Schema físico de `tracking_events` (F3, spec server-tracking).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, timestamps estándar.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por service/DTO/validator/usecase está
// declarado acá — case-sensitive (`reservationId` ≠ `reservationid`). Renombrar un campo en
// el modelo = columna orphan (ADD COLUMN, no rename) → migrar data a mano.
//
// Modelo dual (regla Manager Hotel): el módulo `server-tracking` es DUEÑO del modelo
// `TrackingEvent` → NO se define en `shared/models.ts` (evita la trampa del "último gana"
// que ya picó con lock_codes.hotelId — ver CLAUDE.md "Modelos duales").
//
// El ORM no expone UNIQUE compuesto ni INDEX compuesto. Los índices secundarios
// `(hotelId, event, timestamp)` y `(status, timestamp)` (spec.md DB section) se crean en
// `migrate-db.ts` cuando se cableen los queries de funnel/worker. Por ahora `hotelId`
// lleva `indexed:true` para el filtro individual. `event` y `status` también indexed para
// consultas de auditoría por estado (spec.md "Ver historial").
import type { ModelDefinition, ORM } from 'arckode-framework'

/**
 * Evento de tracking server-side (F3). Una fila por fire (Meta CAPI, GA4-SS) o por evento
 * interno del funnel. El `target` distingue el destino del disparo; `status`跟踪 el ciclo
 * de vida (pending → sent/failed/skipped) para auditoría y reintentos.
 */
export const TrackingEventModel: ModelDefinition = {
  table: 'tracking_events',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    // 'view' | 'search' | 'select' | 'upsell' | 'form' | 'pay' | 'confirm' | 'abandon'.
    // Validado en el service (enum cerrado). F3 solo dispara 'confirm' (Purchase); el resto
    // los genera F4 (funnel analytics) y el widget client-side (F3 3.18).
    event: { type: 'string', required: true, indexed: true },
    // Payload disparado (para auditoría spec.md "Persistencia de eventos"). JSON libre:
    // incluye value/currency/event_id para Meta, client_id/transaction_id para GA4.
    meta: { type: 'json' },
    // Client-side anonymous ID para dedup (spec.md Requirement: Deduplication event_id).
    // Hoy vacío para fires server-side (F2 widget todavía no propaga el anonymousId).
    anonymousId: { type: 'string' },
    // FK a reservations.id. Nullable: los events del funnel pre-booking (view/search/...)
    // no tienen reserva asociada.
    reservationId: { type: 'string', indexed: true },
    // 'meta' | 'ga4' | 'internal'. Distingue el destino del fire. 'internal' = evento del
    // funnel que NO se dispara a un externo (solo se persiste para analytics).
    target: { type: 'string', required: true, indexed: true },
    // 'pending' | 'sent' | 'failed' | 'skipped'. spec.md Requirement: Persistencia.
    status: { type: 'string', required: true, indexed: true },
    // Mensaje de error si status='failed'. Nullable si todo OK.
    errorMessage: { type: 'string' },
    // Momento del fire (espeja el event_time que se manda a Meta). Distinto de createdAt
    // (que es cuando se insertó la fila) — para auditoría de "cuándo se disparó".
    timestamp: { type: 'date', required: true },
  },
  timestamps: true,
}

/** Registra el modelo en el ORM. Idempotente (orm.define usa Map.set). */
export function registerServerTrackingModels(orm: ORM): void {
  orm.define('TrackingEvent', TrackingEventModel)
}
