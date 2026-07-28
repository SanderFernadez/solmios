// promo-codes/model.ts — Schema físico de `promo_codes` (F2, spec booking-widget).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, timestamps estándar.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por service/DTO/validator está
// declarado acá — case-sensitive (`minAmount` ≠ `minamount`, `maxUses` ≠ `maxuses`).
// Si lo agregás en usecases/validators, declaralo acá también o se descarta silenciosamente.
//
// Modelo dual (regla Manager Hotel): el módulo `promo-codes` es DUEÑO del modelo
// `PromoCodes` → NO se define en `shared/models.ts` (evita la trampa del "último gana").
//
// Unique constraint: la tabla NO tiene UNIQUE por (hotelId, code) declarado en el ORM
// (el framework no expone unique compuesto). Se crea con `CREATE UNIQUE INDEX IF NOT
// EXISTS promo_codes_hotel_code ON promo_codes(hotelId, code)` en `migrate-db.ts`
// (multi-motor, PG lowercase, SQLite plano). El service captura la violación y la
// traduce a ValidationError (mismo patrón que folio-entries.createChargeIdempotent).
import type { ModelDefinition, ORM } from 'arckode-framework'

export const PromoCodesModel: ModelDefinition = {
  table: 'promo_codes',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    // 'percent' | 'fixed' — validado en el usecase (enum cerrado).
    code: { type: 'string', required: true },
    // 'percent' (0-100) | 'fixed' (monto en la moneda del hotel).
    kind: { type: 'string', required: true },
    value: { type: 'number', required: true },
    // Subtotal mínimo para que el código aplique (nullable = sin mínimo).
    minAmount: { type: 'number' },
    // Cantidad máxima de usos (nullable = ilimitado).
    maxUses: { type: 'number' },
    // Contador de usos — se incrementa al CREAR la reserva con el código aplicado
    // (task 2.5, NO en el validador público). Default 0.
    uses: { type: 'number', default: 0 },
    // Ventana de validez (nullable = siempre vigente salvo el flag `active`).
    validFrom: { type: 'string' },
    validTo: { type: 'string' },
    // Toggle rápido para desactivar sin borrar. Default 1 (activo).
    active: { type: 'boolean', default: true },
  },
  timestamps: true,
}

/** Registra el modelo en el ORM. Idempotente (orm.define usa Map.set). */
export function registerPromoCodesModels(orm: ORM): void {
  orm.define('PromoCodes', PromoCodesModel)
}
