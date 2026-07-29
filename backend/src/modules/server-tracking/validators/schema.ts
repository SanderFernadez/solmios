// server-tracking/validators/schema.ts — Validación de entrada del módulo (F3).
//
// `validateSchema` (shared/validators/validate-body.ts) devuelve SOLO los campos declarados
// acá (los demás se descartan en silencio — mem anti-patrón ORM). Por eso cada campo
// persistido que venga por la API está declarado acá o se valida en el service.
//
// La validación de enums cerrados (`event`, `target`, `status`) vive en el service: el
// validador del framework no soporta unión discriminada. Acá dejamos el mínimo: required + tipos.
import type { ValidationRule } from 'arckode-framework'

const MAX_ERROR_MSG = 1000

/** POST /api/server-tracking/test — body opcional para forzar un reservationId de prueba.
 *  Por defecto el test-fire arma un payload sintético ({event:'Purchase', value:0}) sin
 *  necesidad de reserva real; si se pasa `reservationId`, dispara con los datos de esa reserva. */
export const TestFireSchema: Record<string, ValidationRule> = {
  reservationId: { type: 'string' as const },
}

/** Query params opcionales de GET /api/server-tracking/events. */
export const EventsQuerySchema: Record<string, ValidationRule> = {
  reservationId: { type: 'string' as const },
  target: { type: 'string' as const },
  status: { type: 'string' as const },
  limit: { type: 'number' as const, min: 1, max: 100 },
}

/** Schema para validar error_message长度 (cap peligroso si un externo devuelve HTML). */
export const MAX_ERROR_MESSAGE_LENGTH = MAX_ERROR_MSG

/** Compuesto para usar en validación directa desde el controller. */
export const ServerTrackingValidator = {
  testFire: TestFireSchema,
  eventsQuery: EventsQuerySchema,
}
