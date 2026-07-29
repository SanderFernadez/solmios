// wallet-pass/validators/schema.ts — Validación de entrada del módulo (F3).
//
// El módulo NO expone POST/PUT públicos para crear passes (se generan automáticamente
// al confirmar la reserva, vía connector). El único endpoint admin es GET (lectura).
// Por eso este archivo está vacío de schemas de escritura — se mantiene por consistencia
// con la estructura canónica de módulos del framework (helpers/orm SKILL lo espera).
//
// Si el día de mañana se agrega un endpoint admin para forzar regeneración manual
// (`POST /api/wallet-pass/regenerate/:reservationId`), definir acá el schema del body.
import type { ValidationRule } from 'arckode-framework'

const MAX_URL_LENGTH = 2048

/**
 * Schema futuro para regeneración manual (no registrado en el router hoy). Lo dejamos
 * declarado para que el día que se active no haya que reconstruirlo desde cero y para
 * documentar qué campos se esperarían (solo `force: boolean` para pisar el existente).
 */
export const RegenerateWalletPassSchema: Record<string, ValidationRule> = {
  force: { type: 'boolean' as const },
}

/** Longitud máxima de URL persistida (defensivo, mismo límite que external-reviews.url). */
export const WALLET_PASS_URL_MAX = MAX_URL_LENGTH

/** Compuesto para usar en validación directa desde el controller. */
export const WalletPassValidator = {
  regenerate: RegenerateWalletPassSchema,
}
