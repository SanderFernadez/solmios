// shared/i18n.ts — Resolución de traducciones multilingüe reutilizable. Originalmente
// extraído de restaurant/usecases/i18n.ts (F4 de carta-experiencia-avanzada) para que
// otros módulos (hotel público, landing) apliquen el mismo patrón. Fallback final SIEMPRE
// español, hardcodeado (D7): `hotels` no tiene ninguna columna de idioma, no existe un
// "idioma base por hotel" en el código.
// Ver openspec/changes/solmi-direct-booking/specs/public-hotel-info/spec.md (D2) y
// openspec/changes/carta-experiencia-avanzada/specs/menu-i18n/spec.md.
import { ValidationError } from 'arckode-framework'

/** Rechaza la clave 'es' dentro de `translations` — el español vive en los campos base
 * (name/description), NUNCA duplicado dentro del mapa de idiomas (evita dos fuentes de verdad). */
export function assertNoBaseLangKey(translations: unknown, fieldHint: string): void {
  if (translations === null || translations === undefined) return
  // La forma (objeto vs array/primitivo) ya la rechaza el validator (`type: 'json'` solo exige
  // objeto o array); acá solo importa la clave 'es' si es un objeto plano.
  if (typeof translations !== 'object' || Array.isArray(translations)) return
  if (Object.prototype.hasOwnProperty.call(translations, 'es')) {
    throw new ValidationError(`El idioma base (es) no se traduce; usá el campo ${fieldHint}`)
  }
}

/**
 * Resuelve una entidad para `lang`, CAMPO POR CAMPO: `translations[lang]?.[campo] ?? valorBase`.
 * - `lang` ausente o `'es'` → la entidad TAL CUAL, sin tocar `translations` (fallback final SIEMPRE
 *   español, D7).
 * - `lang` presente (≠ `'es'`) → copia con los campos resueltos y SIN `translations` crudo (no
 *   duplicar payload — el idioma pedido ya quedó resuelto en `name`/`description`).
 */
export function resolveForLang<
  F extends string,
  T extends { translations?: Record<string, Partial<Record<F, string>>> | null },
>(entity: T, lang: string | undefined, fields: readonly F[]): T {
  if (!lang || lang === 'es') return entity
  const translated = entity.translations?.[lang]
  const resolved: Record<string, unknown> = { ...(entity as Record<string, unknown>) }
  for (const f of fields) {
    const v = translated?.[f]
    if (v !== undefined && v !== null && v !== '') resolved[f] = v
  }
  delete resolved.translations
  return resolved as T
}
