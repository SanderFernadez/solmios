// cancellation/model.ts — Schema físico de `cancellation_policies` (F1, plan #627).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, timestamps estándar.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por service/DTO/validator está
// declarado acá — case-sensitive (`scopeId` ≠ `scopeid`). Si lo agregás en usecases/
// validators, declaralo acá también o se descarta silenciosamente.
//
// Modelo dual (regla Manager Hotel): el módulo `cancellation` es DUEÑO del modelo
// `CancellationPolicies` → NO se define en `shared/models.ts` (evita la trampa del
// "último gana"). El ORM soporta `type: 'json'` nativo (confirmado en
// bookingengine/model.ts `allowedCountries`, paquetes/model.ts `contents`,
// cash/model.ts `denominations`) → `tiers` se persiste como JSON sin serialize a mano.
import type { ModelDefinition, ORM } from 'arckode-framework'

export const CancellationPoliciesModel: ModelDefinition = {
  table: 'cancellation_policies',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    // 'base' | 'channel' | 'rate' | 'season' — validado en el usecase (enum cerrado).
    // base = política por defecto del hotel. channel = override por canal (scopeId=canal).
    // rate = override por tarifa (scopeId=ratePlanId). season = override por temporada (scopeId=seasonId).
    scope: { type: 'string', required: true },
    // Para scope='base' queda ''. Para los demás, el id del canal/tarifa/temporada.
    scopeId: { type: 'string', default: '' },
    // Label humano opcional (ej: "Cancelación flexible OTA").
    name: { type: 'string', default: '' },
    // Array de Tier { deadlineHours, penaltyPercent, refundable, label? }.
    // type:'json' → el ORM serializa/deserializa en ambos motores (INTEGER/text JSON).
    tiers: { type: 'json', default: [] },
    // Orden de precedencia entre políticas del mismo scope (mayor = más específica). Default 0.
    priority: { type: 'number', default: 0 },
    // Toggle rápido para desactivar sin borrar. Default 1 (activo).
    active: { type: 'boolean', default: true },
  },
  timestamps: true,
}

/**
 * Registra el modelo en el ORM. Idempotente (orm.define usa Map.set).
 * F1: solo registra el modelo. Las rutas CRUD llegan en F3.
 */
export function registerCancellationModels(orm: ORM): void {
  orm.define('CancellationPolicies', CancellationPoliciesModel)
}
