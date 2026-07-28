// promo-codes/usecases/promo-validate.ts — Validación PÚBLICA de códigos (F2 2.2).
//
// Entrada: (hotelId, code, subtotal). Salida: { valid, discount, reason? }.
//
// Esta función NO incrementa `uses` — solo calcula si el código es aplicable y cuánto
// descuento generaría. El incremento de `uses` ocurre en el usecase unificado de booking
// (task 2.5) SOLO después de que la reserva se crea exitosamente, atómicamente. Razón:
// si el huésped abandona el flujo tras validar, no debemos consumir un uso.
//
// Razones de rechazo (en orden de evaluación):
//   1. not_found        — no existe code para (hotelId, code upper-case).
//   2. inactive         — active=false (el admin lo pausó sin borrar).
//   3. expired          — validFrom > now OR validTo < now (ventana fuera de rango).
//   4. max_uses_reached — uses >= maxUses (solo si maxUses != null).
//   5. min_amount_not_met — subtotal < minAmount (solo si minAmount != null).
//
// Si todo pasa, calcula discount:
//   - percent: discount = subtotal * value / 100  (value validado en [0,100] al crear).
//   - fixed:   discount = min(value, subtotal)    (no damos cambio; el descuento no
//     puede superar al subtotal para evitar negativos en el total).
//
// Anti-enumeración: el orden es failure-fast para no revelar información extra (ej. no
// decimos "este código existe pero está inactivo" si ya está inactivo — same shape para
// todos los rechazos una vez que no existe). Sin embargo, cuando el código existe pero
// está vencido/agotado, devolver la razón ayuda al huésped a entender el rechazo (UX);
// el equilibrio elegido por el spec (líneas 90-103) es DEVOLVER la razón.
import type { RepositoryAdapter } from 'arckode-framework'
import type {
  PromoCodeDTO, PromoValidationResult,
} from '../types'

export interface PromoValidateDeps {
  promoCodes: RepositoryAdapter<PromoCodeDTO>
}

/** Tolera fechas ISO y devuelve el timestamp epoch; null si la fecha no parsea. */
function toEpochMs(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

/**
 * Valida un código promocional para el hotel y subtotal dados. Endpoint público.
 *
 * Case-insensitive del lado del huésped: normaliza a UPPERCASE antes de buscar (mismo
 * criterio que promo-crud.create → el almacenamiento físico siempre es upper-case, así
 * que el match exacto contra `(hotelId, code)` es correcto).
 */
export async function validate(
  deps: PromoValidateDeps,
  hotelId: string,
  code: string,
  subtotal: number,
): Promise<PromoValidationResult> {
  const normalized = String(code ?? '').trim().toUpperCase()
  if (!normalized || !hotelId) {
    return { valid: false, discount: 0, reason: 'not_found' }
  }

  const sub = Number(subtotal)
  if (!Number.isFinite(sub) || sub < 0) {
    // Subtotal inválido: fail-cerrado, no revelar existencia del code.
    return { valid: false, discount: 0, reason: 'not_found' }
  }

  const found = await deps.promoCodes.findOne({ hotelId, code: normalized })
  if (!found) {
    return { valid: false, discount: 0, reason: 'not_found' }
  }

  // `active` llega como boolean (el ORM normaliza INTEGER ↔ boolean en ambos sentidos,
  // ver model.ts). Por defense-in-depth casteamos: si alguna fila vieja lo tiene como
  // 0/1, lo tratamos igual (truthy → activo).
  const isActive = Boolean((found as any).active)
  if (!isActive) {
    return { valid: false, discount: 0, reason: 'inactive', code: normalized }
  }

  // Ventana de validez (validFrom/validTo, ambos opcionales).
  const now = Date.now()
  const from = toEpochMs(found.validFrom)
  const to = toEpochMs(found.validTo)
  if (from !== null && now < from) {
    return { valid: false, discount: 0, reason: 'expired', code: normalized }
  }
  if (to !== null && now > to) {
    return { valid: false, discount: 0, reason: 'expired', code: normalized }
  }

  // Limite de usos (null = ilimitado).
  const maxUses = found.maxUses
  if (typeof maxUses === 'number' && Number.isFinite(maxUses) && (found.uses ?? 0) >= maxUses) {
    return { valid: false, discount: 0, reason: 'max_uses_reached', code: normalized }
  }

  // Subtotal mínimo (null = sin mínimo).
  const minAmount = found.minAmount
  if (typeof minAmount === 'number' && Number.isFinite(minAmount) && sub < minAmount) {
    return { valid: false, discount: 0, reason: 'min_amount_not_met', code: normalized }
  }

  // Cálculo del descuento.
  const value = Number(found.value) || 0
  let discount = 0
  if (found.kind === 'percent') {
    // value validado en [0,100] en promo-crud.assertValueForKind.
    discount = Math.min(sub, (sub * value) / 100)
  } else if (found.kind === 'fixed') {
    // No dar cambio: el descuento nunca supera al subtotal.
    discount = Math.min(value, sub)
  }
  // Redondeo a 2 decimales (centavos) para evitar float drift.
  discount = Math.round(discount * 100) / 100

  return { valid: true, discount, code: normalized }
}
