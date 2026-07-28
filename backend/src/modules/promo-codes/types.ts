// promo-codes/types.ts — DTOs y tipos del módulo (API contract, F2 booking-widget).
// El schema físico de la tabla vive en ./model.ts — son conceptos distintos (mem
// anti-patrón ORM: TODO campo del DTO está declarado en model.ts case-sensitive).

/** Kind del descuento. Porcentaje sobre subtotal o monto fijo en la moneda del hotel. */
export type PromoCodeKind = 'percent' | 'fixed'

/**
 * DTO de lectura. Espeja los campos persistidos en `promo_codes` (model.ts).
 * El ORM normaliza `active` 0/1 ↔ false/true automáticamente.
 */
export interface PromoCodeDTO {
  id: string
  hotelId: string
  /** Upper-case en el usecase al crear/editar. Único por (hotelId, code). */
  code: string
  kind: PromoCodeKind
  /** Porcentaje (0-100) si kind='percent'; monto fijo si kind='fixed'. */
  value: number
  /** Subtotal mínimo requerido para aplicar. null = sin mínimo. */
  minAmount: number | null
  /** Cantidad máxima de usos. null = ilimitado. */
  maxUses: number | null
  /** Usos actuales. Se incrementa al crear reserva con el código aplicado (task 2.5). */
  uses: number
  /** ISO date nullable. null = sin ventana de inicio. */
  validFrom: string | null
  /** ISO date nullable. null = sin vencimiento. */
  validTo: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Body del POST /api/promo-codes. */
export interface CreatePromoCodeDTO {
  code: string
  kind: PromoCodeKind
  value: number
  minAmount?: number | null
  maxUses?: number | null
  validFrom?: string | null
  validTo?: string | null
  active?: boolean
}

/** Body del PUT /api/promo-codes/:id. Todos opcionales (partial). */
export interface UpdatePromoCodeDTO {
  code?: string
  kind?: PromoCodeKind
  value?: number
  minAmount?: number | null
  maxUses?: number | null
  validFrom?: string | null
  validTo?: string | null
  active?: boolean
  /** Permitir resetear `uses` (ej. campaña nueva sobre el mismo code). Opcional. */
  uses?: number
}

/** Body del POST /api/public/hotels/:slug/promo/validate (sin auth, rate-limited). */
export interface ValidatePromoCodeDTO {
  code: string
  /** Subtotal sobre el cual aplicar el descuento (antes de impuestos). */
  subtotal: number
}

/** Resultado del validador público. `reason` solo se devuelve cuando `valid=false`. */
export interface PromoValidationResult {
  valid: boolean
  /** Descuento calculado sobre el subtotal (0 si invalid). */
  discount: number
  reason?: 'not_found' | 'expired' | 'max_uses_reached' | 'min_amount_not_met' | 'inactive'
  /** Eco del código normalizado (upper-case) que el frontend puede mostrar. */
  code?: string
}

/** Usuario autenticado (req.user). Para ownership (IDOR) y forzar hotelId. */
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
  userType?: string
}
